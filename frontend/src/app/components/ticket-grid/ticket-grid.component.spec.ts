import { LucideAngularModule } from 'lucide-angular';
import { appIcons } from '../../app.icons';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketGridComponent } from './ticket-grid.component';

describe('TicketGridComponent', () => {
  let component: TicketGridComponent;
  let fixture: ComponentFixture<TicketGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      imports: [LucideAngularModule.pick(appIcons), TicketGridComponent]
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
