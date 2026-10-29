import { TestBed } from '@angular/core/testing';

import { CustomersApi } from './customers-api';

describe('CustomersApi', () => {
  let service: CustomersApi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CustomersApi);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
