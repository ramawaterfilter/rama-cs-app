import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { TicketGridComponent } from './ticket-grid.component';

describe('TicketGridComponent', () => {
  let component: TicketGridComponent;
  let fixture: ComponentFixture<TicketGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketGridComponent],
      providers: [provideHttpClient(), provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TicketGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exports captured ticket data in the mapped columns', () => {
    component.filteredTickets = [{
      id: 7,
      customer_name: 'Karan',
      country_dynamic: { name: 'India' },
      country: null,
      address: '12 MG Road, Bengaluru',
      remarks: 'Refunded full amount',
      action_taken: null,
      query_channel: { name: 'Email' },
      outreach: { name: 'Web' },
      replacement: null,
      ticket_return: {
        le_id: 3,
        status: 'in transit',
        remarks: 'Packed',
        ordered_product_name: 'Filter',
        ordered_product_sku: 'F1',
        marketplace_channel: 'Amazon',
        return_date: '2026-01-05',
        no_of_boxes: 2,
        inbound_ref_no: 'IR-9',
        inbound_ref_date: '2026-01-06',
        courier_name: 'BlueDart',
        tracking_id: 'TRK-1',
        le: { name: 'LE One' }
      }
    }];

    const [row] = component.buildExportRows();

    expect(row['Country']).toBe('India');
    expect(row['Address']).toBe('12 MG Road, Bengaluru');
    expect(row['Action Taken']).toBe('Refunded full amount');
    expect(row['Query Channel']).toBe('Email');
    expect(row['Outreach']).toBe('Web');
    expect(row['Marketplace']).toBe('Amazon');
    expect(row['Return Date']).toBe('2026-01-05');
    expect(row['No. of Boxes']).toBe(2);
    expect(row['Inbound Ref No']).toBe('IR-9');
    expect(row['Courier Name']).toBe('BlueDart');
    expect(row['Tracking ID']).toBe('TRK-1');
    expect(row['Assigned LE']).toBe('LE One');
    expect(row['LE Remarks']).toBe('Packed');
  });

  it('falls back to the legacy country string and seeder action_taken', () => {
    component.filteredTickets = [{
      id: 8,
      country: 'India',
      action_taken: 'Old note',
      remarks: null
    }];

    const [row] = component.buildExportRows();

    expect(row['Country']).toBe('India');
    expect(row['Action Taken']).toBe('Old note');
  });
});
