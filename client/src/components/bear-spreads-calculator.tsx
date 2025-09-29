import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@client/components/ui/card';
import { Input } from '@client/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@client/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Switch } from '@client/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { api } from '@client/lib/api';
import { useWebSocketContext } from '@client/routes/__root';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Edit2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const entryPriceSchema = z.object({
  entryPrice: z.number().positive('Entry price must be positive'),
});

export function BearSpreadsCalculator() {
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');

  // Entry price and orders state
  const [entryPriceInput, setEntryPriceInput] = useState<string>('');
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  // Fetch expiries
  const { data: expiries = [], isLoading: expiryLoading } = useQuery({
    queryKey: ['expiries'],
    queryFn: async () => {
      const response = await api.expiries.$get();
      return response.json();
    },
  });

  // Fetch market data with polling
  const { data: marketData, isLoading: marketDataLoading } = useQuery({
    queryKey: ['market-data'],
    queryFn: async () => {
      const response = await api['market-data'].$get();
      return response.json();
    },
    refetchInterval: 500, // Poll every second
    enabled: true,
  });

  // Subscribe to expiry mutation
  const subscribeToExpiry = useMutation({
    mutationFn: async (expiry: string) => {
      const response = await api.subscribe.$post({
        json: { expiry },
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error('Failed to subscribe to expiry');
      console.error('Subscribe error:', error);
    },
  });

  // Set entry price mutation
  const setEntryPrice = useMutation({
    mutationFn: async (entryPrice: number) => {
      const response = await api.orders['set-entry-price'].$post({
        json: { entryPrice },
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setIsEditingPrice(false);
    },
    onError: (error) => {
      toast.error('Failed to set entry price');
      console.error('Set entry price error:', error);
    },
  });

  // Toggle orders mutation
  const toggleOrders = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await api.orders.toggle.$post({
        json: { enabled },
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error('Failed to toggle orders');
      console.error('Toggle orders error:', error);
    },
  });

  // WebSocket connection for real-time spreads and order status
  const { spreadsData, orderStatus } = useWebSocketContext();

  const handleExpiryChange = (expiry: string) => {
    setSelectedExpiry(expiry);
    subscribeToExpiry.mutate(expiry);
  };

  const handleEntryPriceSubmit = () => {
    try {
      const parsedPrice = parseFloat(entryPriceInput);
      const result = entryPriceSchema.parse({ entryPrice: parsedPrice });
      setEntryPrice.mutate(result.entryPrice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.issues[0]?.message || 'Invalid entry price');
      } else {
        toast.error('Invalid entry price');
      }
    }
  };

  const handleOrdersToggle = (enabled: boolean) => {
    if (enabled && !orderStatus.entryPrice) {
      toast.error('Please set an entry price first');
      return;
    }
    toggleOrders.mutate(enabled);
  };

  const openEntryPriceEdit = () => {
    setEntryPriceInput(orderStatus.entryPrice?.toString() || '');
    setIsEditingPrice(true);
  };

  return (
    <div className='mx-auto max-w-6xl space-y-8 p-6'>
      {/* Controls */}
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
        {/* Instrument */}
        <div className='space-y-2'>
          <label className='text-muted-foreground text-sm font-medium'>Instrument</label>
          <Select disabled>
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Nifty 50' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='nifty50'>Nifty 50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Expiry */}
        <div className='space-y-2'>
          <label className='text-muted-foreground text-sm font-medium'>Expiry</label>
          <Select
            value={selectedExpiry}
            onValueChange={handleExpiryChange}
            disabled={expiryLoading || subscribeToExpiry.isPending}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Select expiry...' />
            </SelectTrigger>
            <SelectContent>
              {expiries.map((expiry) => (
                <SelectItem key={expiry} value={expiry}>
                  {expiry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Entry Price */}
        <div className='space-y-2'>
          <label className='text-muted-foreground text-sm font-medium'>Entry Price</label>
          <div className='flex items-center gap-2'>
            <Input
              value={orderStatus.entryPrice?.toString() || ''}
              placeholder='Set entry price...'
              readOnly
              className='flex-1'
            />
            <Popover open={isEditingPrice} onOpenChange={setIsEditingPrice}>
              <PopoverTrigger asChild>
                <Button variant='outline' size='sm' onClick={openEntryPriceEdit} className='px-3'>
                  <Edit2 className='h-4 w-4' />
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-80' align='end'>
                <div className='space-y-4'>
                  <div className='space-y-2'>
                    <h4 className='font-medium leading-none'>Set Entry Price</h4>
                    <p className='text-muted-foreground text-sm'>Enter the price for order monitoring range (±{5}).</p>
                  </div>
                  <div className='space-y-3'>
                    <Input
                      type='number'
                      placeholder='Enter price...'
                      value={entryPriceInput}
                      onChange={(e) => setEntryPriceInput(e.target.value)}
                      min={0}
                      step={0.01}
                    />
                    <div className='flex gap-2'>
                      <Button variant='outline' size='sm' onClick={() => setIsEditingPrice(false)} className='flex-1'>
                        Cancel
                      </Button>
                      <Button
                        size='sm'
                        onClick={handleEntryPriceSubmit}
                        disabled={setEntryPrice.isPending}
                        className='flex-1'
                      >
                        {setEntryPrice.isPending ? 'Setting...' : 'Submit'}
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Orders Toggle */}
        <div className='space-y-2'>
          <label className='text-muted-foreground text-sm font-medium'>Orders</label>
          <div className='flex h-9 items-center px-3'>
            <div className='flex items-center gap-3'>
              <Switch
                checked={orderStatus.ordersEnabled}
                onCheckedChange={handleOrdersToggle}
                disabled={toggleOrders.isPending || !orderStatus.entryPrice}
              />
              <span className='text-sm font-medium'>{orderStatus.ordersEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Strike Information */}
      <Card>
        <CardContent className='p-6'>
          <div className='grid grid-cols-3 gap-6'>
            <div className='text-center'>
              <div className='space-y-2'>
                <label className='text-muted-foreground text-sm font-medium'>ITM Strike</label>
                <div className='text-2xl font-bold tabular-nums'>
                  {marketDataLoading ? '...' : marketData?.itmStrike || 0}
                </div>
              </div>
            </div>

            <div className='text-center'>
              <div className='space-y-2'>
                <label className='text-muted-foreground text-sm font-medium'>Nifty</label>
                <div className='text-primary text-2xl font-bold tabular-nums'>
                  {marketDataLoading ? '...' : marketData?.niftyPrice || 0}
                </div>
              </div>
            </div>

            <div className='text-center'>
              <div className='space-y-2'>
                <label className='text-muted-foreground text-sm font-medium'>OTM Strike</label>
                <div className='text-2xl font-bold tabular-nums'>
                  {marketDataLoading ? '...' : marketData?.otmStrike || 0}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Spreads Table */}
      <Card>
        <CardHeader>
          <CardTitle className='text-center'>Bear Spreads Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='text-muted-foreground text-center'>Bear Call Spread</TableHead>
                <TableHead className='text-muted-foreground text-center'>Metric</TableHead>
                <TableHead className='text-muted-foreground text-center'>Bear Put Spread</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className='bg-emerald-50/60 text-center text-lg font-semibold tabular-nums text-emerald-800 dark:bg-emerald-900/5 dark:text-emerald-500'>
                  {spreadsData?.callSpread.maxProfit?.toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className='text-center font-semibold'>Max Profit</TableCell>
                <TableCell className='bg-emerald-50/60 text-center text-lg font-semibold tabular-nums text-emerald-800 dark:bg-emerald-900/5 dark:text-emerald-500'>
                  {spreadsData?.putSpread.maxProfit?.toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className='bg-red-50/60 text-center text-lg font-semibold tabular-nums text-red-800 dark:bg-red-900/5 dark:text-red-500'>
                  {spreadsData?.callSpread.maxLoss?.toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className='text-center font-semibold'>Max Loss</TableCell>
                <TableCell className='bg-red-50/60 text-center text-lg font-semibold tabular-nums text-red-800 dark:bg-red-900/5 dark:text-red-500'>
                  {spreadsData?.putSpread.maxLoss?.toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className='text-center text-lg font-semibold tabular-nums'>
                  {spreadsData?.callSpread.creditOrDebit?.toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className='text-center font-semibold'>Credit/Debit</TableCell>
                <TableCell className='text-center text-lg font-semibold tabular-nums'>
                  {spreadsData?.putSpread.creditOrDebit?.toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className='bg-yellow-50/60 text-center text-lg font-semibold tabular-nums text-yellow-800 dark:bg-yellow-900/5 dark:text-yellow-500'>
                  {spreadsData?.callSpread.breakEven?.toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className='text-center font-semibold'>Breakeven</TableCell>
                <TableCell className='bg-yellow-50/60 text-center text-lg font-semibold tabular-nums text-yellow-800 dark:bg-yellow-900/5 dark:text-yellow-500'>
                  {spreadsData?.putSpread.breakEven?.toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
