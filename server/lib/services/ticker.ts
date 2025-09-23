import { env } from '@server/lib/env';
import { logger } from '@server/lib/logger';
import { accessToken } from '@server/lib/services/accessToken';
import { strikesService } from '@server/lib/services/strikes';
import type { StrikeTokensMap } from '@server/types/types';
import type { WSContext } from 'hono/ws';
import { KiteTicker, type TickFull, type TickLtp } from 'kiteconnect-ts';

type StrikeTokensMapOptional = {
  [K in keyof StrikeTokensMap]: StrikeTokensMap[K] | undefined;
};

class TickerService {
  NIFTY_TOKEN!: number;
  NIFTY_PRICE = 0;
  LOT_SIZE = 75;

  private ticker = new KiteTicker({
    api_key: env.KITE_API_KEY,
    access_token: accessToken,
  });
  private client: WSContext | null = null;
  private subscribedTokens = new Set<number>();

  private expiry: string | null = null;
  public strikeTokensMap: StrikeTokensMapOptional = {
    ceMinus: undefined,
    cePlus: undefined,
    peMinus: undefined,
    pePlus: undefined,
  };
  private bidAskMap: Record<string, { bid: number; ask: number }> = {};

  private subscribeToTokens(tokens: number[]) {
    for (const token of tokens) {
      if (this.subscribedTokens.has(token)) {
        continue;
      }
      this.subscribedTokens.add(token);
    }
    this.ticker.setMode('full', [...tokens]);
  }

  private unsubscribeFromTokens(tokens?: number[]) {
    tokens = tokens ?? Array.from(this.subscribedTokens);
    for (const token of tokens) {
      this.subscribedTokens.delete(token);
    }
    this.ticker.unsubscribe([...tokens]);
  }

  private calculateSpreads() {
    if (
      !this.strikeTokensMap.ceMinus ||
      !this.strikeTokensMap.cePlus ||
      !this.strikeTokensMap.peMinus ||
      !this.strikeTokensMap.pePlus
    ) {
      return;
    }

    // Put calculations
    const peSpreadWidth = this.strikeTokensMap.pePlus.strike - this.strikeTokensMap.peMinus.strike;

    const pePlusAsk = this.bidAskMap[this.strikeTokensMap.pePlus.token]?.ask || 0;
    const peMinusBid = this.bidAskMap[this.strikeTokensMap.peMinus.token]?.bid || 0;
    const peNetDebit = pePlusAsk - peMinusBid;

    const peMaxProfit = (peSpreadWidth - peNetDebit) * this.LOT_SIZE;
    const peMaxLoss = peNetDebit * this.LOT_SIZE;
    const peBreakEven = this.strikeTokensMap.pePlus.strike - peNetDebit;

    // Call calculations
    const ceSpreadWidth = this.strikeTokensMap.cePlus.strike - this.strikeTokensMap.ceMinus.strike;

    const cePlusAsk = this.bidAskMap[this.strikeTokensMap.cePlus.token]?.ask || 0;
    const ceMinusBid = this.bidAskMap[this.strikeTokensMap.ceMinus.token]?.bid || 0;
    const ceNetCredit = ceMinusBid - cePlusAsk;

    const ceMaxProfit = ceNetCredit * this.LOT_SIZE;
    const ceMaxLoss = (ceSpreadWidth - ceNetCredit) * this.LOT_SIZE;
    const ceBreakEven = this.strikeTokensMap.ceMinus.strike + ceNetCredit;

    return {
      callSpread: {
        maxProfit: ceMaxProfit,
        maxLoss: ceMaxLoss,
        creditOrDebit: ceNetCredit,
        breakEven: ceBreakEven,
      },
      putSpread: {
        maxProfit: peMaxProfit,
        maxLoss: peMaxLoss,
        creditOrDebit: peNetDebit,
        breakEven: peBreakEven,
      },
    };
  }

  async init(niftyToken: number) {
    this.NIFTY_TOKEN = niftyToken;

    logger.info('Connecting to Kite Ticker');
    await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timed out'));
      }, 10000);

      this.ticker.on('connect', () => {
        resolve(true);
        clearTimeout(timeoutId);
      });

      this.ticker.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      this.ticker.connect();
    });
    logger.info('Connected to Kite Ticker');

    this.ticker.on('ticks', (ticks: (TickLtp | TickFull)[]) => {
      for (const tick of ticks) {
        if (tick.instrument_token === this.NIFTY_TOKEN) {
          this.updateNiftyPrice(tick.last_price);
        } else if (tick.mode === 'full') {
          if (!this.bidAskMap[tick.instrument_token]) {
            this.bidAskMap[tick.instrument_token] = { bid: 0, ask: 0 };
          }
          this.bidAskMap[tick.instrument_token]!.bid = tick.depth?.buy[0]?.price ?? 0;
          this.bidAskMap[tick.instrument_token]!.ask = tick.depth?.sell[0]?.price ?? 0;
        }
      }
    });

    setInterval(() => {
      const spreads = this.calculateSpreads();
      if (spreads && this.client) {
        this.client.send(JSON.stringify(spreads));
      }
    }, 250);
  }

  public subscribeToNifty() {
    this.ticker.setMode('ltp', [this.NIFTY_TOKEN]);
  }

  public updateNiftyPrice(price: number) {
    this.NIFTY_PRICE = price;
    if (
      this.expiry &&
      this.strikeTokensMap.ceMinus &&
      this.strikeTokensMap.cePlus &&
      (this.NIFTY_PRICE < this.strikeTokensMap.ceMinus.strike || this.NIFTY_PRICE > this.strikeTokensMap.cePlus.strike)
    ) {
      this.subscribe(this.expiry);
    }
  }

  public subscribe(expiry: string) {
    this.expiry = expiry;

    const atm = tickerService.NIFTY_PRICE;
    const map = strikesService.getStrikesForExpiry(expiry, atm);
    this.strikeTokensMap = map;

    this.unsubscribeFromTokens();
    this.subscribeToTokens([map.ceMinus.token, map.cePlus.token, map.peMinus.token, map.pePlus.token]);
  }

  public addClient(client: WSContext) {
    if (this.client) {
      throw new Error('Client already connected');
    }
    this.client = client;
  }

  public removeClient() {
    this.client = null;
  }

  public async disconnect() {
    this.ticker.disconnect();
  }
}

export const tickerService = new TickerService();
