import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CseDashboardComponent } from './cse-dashboard.component';

describe('CseDashboardComponent', () => {
  let component: CseDashboardComponent;
  let fixture: ComponentFixture<CseDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CseDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CseDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
