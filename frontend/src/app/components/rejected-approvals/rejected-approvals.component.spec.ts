import { LucideAngularModule } from 'lucide-angular';
import { appIcons } from '../../app.icons';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RejectedApprovalsComponent } from './rejected-approvals.component';

describe('RejectedApprovalsComponent', () => {
  let component: RejectedApprovalsComponent;
  let fixture: ComponentFixture<RejectedApprovalsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      imports: [LucideAngularModule.pick(appIcons), RejectedApprovalsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RejectedApprovalsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
