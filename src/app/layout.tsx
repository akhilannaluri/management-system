import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Attendance | Class Portal',
  description: 'Premium QR Code Student Attendance System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
