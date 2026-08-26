import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PurchaseStoreManagementComponent } from './purchase-store-management.component';

describe('PurchaseStoreManagementComponent', () => {
  let component: PurchaseStoreManagementComponent;
  let fixture: ComponentFixture<PurchaseStoreManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchaseStoreManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PurchaseStoreManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
