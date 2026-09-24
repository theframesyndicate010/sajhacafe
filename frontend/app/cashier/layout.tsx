import "@/styles/cashier.css";
import { CashierLayout } from "@/components/cashier/cashier-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CashierLayout>{children}</CashierLayout>;
}
