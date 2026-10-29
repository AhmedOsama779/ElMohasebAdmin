import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCustomers } from './admin-customers';

describe('AdminCustomers', () => {
  let component: AdminCustomers;
  let fixture: ComponentFixture<AdminCustomers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCustomers]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminCustomers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
