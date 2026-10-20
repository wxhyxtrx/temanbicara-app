import type { Metadata } from 'next';
import { MaintenanceView } from '@/components/views/maintenance/maintenance-view';

export const metadata: Metadata = {
  title: 'Pemeliharaan Sistem - TemanBicara',
  description:
    'Sistem TemanBicara sedang dalam proses pemeliharaan berkala untuk peningkatan performa dan keandalan layanan.',
};

export default function MaintenancePage() {
  return <MaintenanceView />;
}
