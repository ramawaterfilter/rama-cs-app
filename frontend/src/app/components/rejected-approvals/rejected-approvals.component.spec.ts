import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RejectedApprovalsComponent } from './rejected-approvals.component';

describe('RejectedApprovalsComponent', () => {
  let component: RejectedApprovalsComponent;
  let fixture: ComponentFixture<RejectedApprovalsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RejectedApprovalsComponent]
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
