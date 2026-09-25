import { appointmentService } from '../src/services/appointmentService';
import { Appointment } from '../src/types/domain';

describe('Appointments Service and Availability', () => {
  it('correctly detects taken slots from booked appointments', () => {
    const mockAppointments: Appointment[] = [
      {
        id: '1',
        shop_id: 'shop_1',
        customer_id: null,
        customer_name: 'Faisal Ahmed',
        staff_id: null,
        staff_name: 'Rakesh Yadav',
        service_id: null,
        service_name: 'Global colour',
        starts_at: '10:30',
        duration_minutes: 90,
        status: 'In chair',
        notes: null,
        amount_minor: 180000,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        shop_id: 'shop_1',
        customer_id: null,
        customer_name: 'Sandeep Nair',
        staff_id: null,
        staff_name: 'Vinod Kumar',
        service_id: null,
        service_name: 'Beard colour',
        starts_at: '12:00',
        duration_minutes: 30,
        status: 'Confirmed',
        notes: null,
        amount_minor: 50000,
        created_at: new Date().toISOString(),
      },
    ];

    const slots = appointmentService.getAvailableSlots(mockAppointments);

    const slot1030 = slots.find((s) => s.slot === '10:30');
    const slot1200 = slots.find((s) => s.slot === '12:00');
    const slot1000 = slots.find((s) => s.slot === '10:00');

    expect(slot1030?.taken).toBe(true);
    expect(slot1200?.taken).toBe(true);
    expect(slot1000?.taken).toBe(false);
  });
});
