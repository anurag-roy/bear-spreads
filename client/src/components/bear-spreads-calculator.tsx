import { Card, CardContent, CardHeader, CardTitle } from '@client/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { useWebSocket } from '@client/hooks/use-websocket';
import { api } from '@client/lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

export function BearSpreadsCalculator() {
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');

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
    refetchInterval: 1000, // Poll every second
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

  // WebSocket connection for real-time spreads
  const { spreadsData, isConnected } = useWebSocket();

  const handleExpiryChange = (expiry: string) => {
    setSelectedExpiry(expiry);
    subscribeToExpiry.mutate(expiry);
  };

  return (
    <div className='mx-auto max-w-6xl space-y-8 p-6'>
      {/* Controls */}
      <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
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

        {/* Connection Status */}
        <div className='space-y-2'>
          <label className='text-muted-foreground text-sm font-medium'>Connection</label>
          <div className='flex h-9 items-center px-3'>
            <div className='flex items-center gap-2'>
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span
                className={`text-sm font-medium ${
                  isConnected ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                }`}
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
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
                <TableHead className='text-center font-semibold'>Bear Call Spread</TableHead>
                <TableHead className='text-center font-semibold'>Metric</TableHead>
                <TableHead className='text-center font-semibold'>Bear Put Spread</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className='text-center text-lg font-semibold tabular-nums'>
                  {spreadsData?.callSpread.maxProfit?.toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className='text-muted-foreground text-center font-medium'>Max Profit</TableCell>
                <TableCell className='text-center text-lg font-semibold tabular-nums'>
                  {spreadsData?.putSpread.maxProfit?.toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className='text-center text-lg font-semibold tabular-nums'>
                  {spreadsData?.callSpread.maxLoss?.toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className='text-muted-foreground text-center font-medium'>Max Loss</TableCell>
                <TableCell className='text-center text-lg font-semibold tabular-nums'>
                  {spreadsData?.putSpread.maxLoss?.toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className='text-center text-lg font-semibold tabular-nums'>
                  {spreadsData?.callSpread.creditOrDebit?.toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className='text-muted-foreground text-center font-medium'>Credit/Debit</TableCell>
                <TableCell className='text-center text-lg font-semibold tabular-nums'>
                  {spreadsData?.putSpread.creditOrDebit?.toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className='text-center text-lg font-semibold tabular-nums'>
                  {spreadsData?.callSpread.breakEven?.toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className='text-muted-foreground text-center font-medium'>Breakeven</TableCell>
                <TableCell className='text-center text-lg font-semibold tabular-nums'>
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
