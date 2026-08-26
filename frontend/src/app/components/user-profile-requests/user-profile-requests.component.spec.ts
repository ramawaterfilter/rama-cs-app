import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserProfileRequestsComponent } from './user-profile-requests.component';

describe('UserProfileRequestsComponent', () => {
  let component: UserProfileRequestsComponent;
  let fixture: ComponentFixture<UserProfileRequestsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProfileRequestsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserProfileRequestsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
