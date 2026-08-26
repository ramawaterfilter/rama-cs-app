import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketGridComponent } from './ticket-grid.component';

describe('TicketGridComponent', () => {
  let component: TicketGridComponent;
  let fixture: ComponentFixture<TicketGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketGridComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TicketGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
