import { strikesService } from '@server/lib/services/strikes';
import { tickerService } from '@server/lib/services/ticker';
import { routeValidator } from '@server/middlewares/validator';
import { Hono } from 'hono';
import { z } from 'zod';

export const rootRoute = new Hono()
  .get('/expiries', async (c) => {
    const expiries = strikesService.getUniqueExpiries();
    return c.json(expiries);
  })
  .get('/market-data', async (c) => {
    const niftyPrice = tickerService.NIFTY_PRICE;
    const itmStrike = tickerService.strikeTokensMap.ceMinus?.strike || 0;
    const otmStrike = tickerService.strikeTokensMap.cePlus?.strike || 0;

    return c.json({
      niftyPrice,
      itmStrike,
      otmStrike,
    });
  })
  .post(
    '/subscribe',
    routeValidator(
      'json',
      z.object({
        expiry: z.string(),
      })
    ),
    async (c) => {
      const { expiry } = c.req.valid('json');

      tickerService.subscribe(expiry);

      return c.json({
        message: 'Subscribed to expiry',
      });
    }
  )
  .post(
    '/orders/set-entry-price',
    routeValidator(
      'json',
      z.object({
        entryPrice: z.number().positive(),
      })
    ),
    async (c) => {
      const { entryPrice } = c.req.valid('json');

      tickerService.setEntryPrice(entryPrice);

      return c.json({
        message: 'Entry price set successfully',
        entryPrice,
      });
    }
  )
  .post(
    '/orders/toggle',
    routeValidator(
      'json',
      z.object({
        enabled: z.boolean(),
      })
    ),
    async (c) => {
      const { enabled } = c.req.valid('json');

      tickerService.setOrdersEnabled(enabled);

      return c.json({
        message: enabled ? 'Order monitoring enabled' : 'Order monitoring disabled',
        enabled,
      });
    }
  );
