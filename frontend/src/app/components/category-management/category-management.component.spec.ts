import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CategoryManagementComponent } from './category-management.component';

describe('CategoryManagementComponent bulk upload', () => {
  let component: CategoryManagementComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    component = TestBed.runInInjectionContext(() => new CategoryManagementComponent());
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function select(file: File) {
    component.selectBulkFile({ target: { files: [file] } } as unknown as Event);
  }

  it('rejects unsupported and oversized files before sending a request', () => {
    select(new File(['data'], 'categories.xlsx'));
    expect(component.bulkFile).toBeNull();
    expect(component.bulkErrors.length).toBe(1);
    select(new File(['x'.repeat(1024 * 1024 + 1)], 'categories.csv'));
    expect(component.bulkFile).toBeNull();
    component.uploadBulk();
    http.expectNone('/api/categories/bulk');
  });

  it('validates without applying and clears the preview when the file changes', () => {
    select(new File(['csv'], 'categories.csv'));
    component.uploadBulk();
    const request = http.expectOne('/api/categories/bulk');
    expect(request.request.body.get('apply')).toBe('0');
    request.flush({ rows: [{ row: 2, name: 'Support', action: 'Create' }] });
    expect(component.bulkRows.length).toBe(1);
    expect(component.bulkBusy).toBeFalse();
    select(new File(['different csv'], 'other.csv'));
    expect(component.bulkRows).toEqual([]);
  });

  it('shows server row errors and clears the rejected preview', () => {
    select(new File(['csv'], 'categories.csv'));
    component.bulkRows = [{ row: 2 }];
    component.uploadBulk(true);
    http.expectOne('/api/categories/bulk').flush({ errors: { 'row.3': ['Row 3: invalid parent.'] } },
      { status: 422, statusText: 'Unprocessable Content' });
    expect(component.bulkErrors).toEqual(['Row 3: invalid parent.']);
    expect(component.bulkRows).toEqual([]);
    expect(component.bulkBusy).toBeFalse();
  });

  it('shows the hierarchy preview returned for the RAMA sheet', () => {
    select(new File(['Type of Query,Query Category,Sub Category,Child Category\nInquiry,Customer Info,Address,Address change'], 'rama.csv'));
    component.uploadBulk();
    const rows = [{ row: 2, action: 'Create / Link', 'Type of Query': 'Inquiry', 'Query Category': 'Customer Info', 'Sub Category': 'Address', 'Child Category': 'Address change' }];
    http.expectOne('/api/categories/bulk').flush({ format: 'hierarchy', rows });
    expect(component.bulkFormat).toBe('hierarchy');
    expect(component.bulkRows).toEqual(rows);
  });

  it('downloads a sample CSV with a descriptive filename', () => {
    const link = document.createElement('a');
    spyOn(document, 'createElement').and.returnValue(link);
    spyOn(link, 'click');
    spyOn(URL, 'createObjectURL').and.returnValue('blob:sample');
    spyOn(URL, 'revokeObjectURL');
    component.downloadBulkTemplate();
    const request = http.expectOne('/api/categories/bulk-template');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['Type of Query,Query Category,Sub Category,Child Category\n'], { type: 'text/csv' }));
    expect(link.download).toBe('category-upload-sample.csv');
    expect(link.click).toHaveBeenCalled();
    expect(component.bulkBusy).toBeFalse();
  });

  it('applies once and refreshes categories after success', () => {
    spyOn(component, 'load');
    select(new File(['csv'], 'categories.csv'));
    component.uploadBulk(true);
    component.uploadBulk(true);
    const request = http.expectOne('/api/categories/bulk');
    expect(request.request.body.get('apply')).toBe('1');
    request.flush({ message: '2 categories saved successfully.' });
    expect(component.load).toHaveBeenCalledTimes(1);
    expect(component.bulkFile).toBeNull();
    expect(component.bulkRows).toEqual([]);
    expect(component.bulkMessage).toBe('2 categories saved successfully.');
  });
});
