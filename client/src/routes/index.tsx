import { BearSpreadsCalculator } from '@client/components/bear-spreads-calculator';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

function RouteComponent() {
  return <BearSpreadsCalculator />;
}
