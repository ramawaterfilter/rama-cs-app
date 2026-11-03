import { LucideAngularModule } from 'lucide-angular';
import { appIcons } from '../../app.icons';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatusManagementComponent } from './status-management.component';

describe('StatusManagementComponent', () => {
  let component: StatusManagementComponent;
  let fixture: ComponentFixture<StatusManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      imports: [LucideAngularModule.pick(appIcons), StatusManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StatusManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
