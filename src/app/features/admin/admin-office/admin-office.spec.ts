import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminOffice } from './admin-office';

describe('AdminOffice', () => {
  let component: AdminOffice;
  let fixture: ComponentFixture<AdminOffice>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOffice]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminOffice);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
