import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ContactInfo, ContactInput, ContactLocation, ContactPhone } from '../../../core/models/api.models';
import { Admin } from '../../../core/services/admin';
import { Catalog } from '../../../core/services/catalog';
import { arabicError } from '../../../shared/utils/errors';
import { formatDateTime } from '../../../shared/utils/format';

const URL_PATTERN = /^https?:\/\/\S+$/i;

// Empty is fine (the field is optional), otherwise it must be an http(s) link
function optionalUrl(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  return !value || URL_PATTERN.test(value) ? null : { url: true };
}

// The server rejects repeated phones and repeated office names, so we check before sending
function noDuplicates(key: string, normalize: (s: string) => string = s => s): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const values = (control as FormArray).controls
      .map(c => normalize(String(c.get(key)?.value ?? '').trim().toLowerCase()))
      .filter(Boolean);
    return new Set(values).size === values.length ? null : { duplicate: true };
  };
}

const blankToNull = (value: string): string | null => value.trim() || null;

@Component({
  selector: 'app-admin-office',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-office.html',
  styleUrl: './admin-office.scss',
})
export class AdminOffice {
  private fb = inject(FormBuilder);
  private admin = inject(Admin);
  private catalog = inject(Catalog);

  formatDateTime = formatDateTime;

  loading = signal(true);
  loadError = signal<string | null>(null);

  // The last data loaded from (or saved to) the server
  original = signal<ContactInfo | null>(null);
  updatedAt = computed(() => this.original()?.updatedAt ?? null);

  saving = signal(false);
  saved = signal(false);
  saveError = signal<string | null>(null);

  phones = new FormArray<FormGroup>([], {
    validators: noDuplicates('phone', s => s.replace(/[\s-]/g, '')),
  });
  locations = new FormArray<FormGroup>([], { validators: noDuplicates('locationName') });

  form = this.fb.nonNullable.group({
    contactText: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    workingDays: [''],
    workingTimes: [''],
    extraNotes: [''],
    facebookUrl: ['', optionalUrl],
    xUrl: ['', optionalUrl],
    whatsAppUrl: ['', optionalUrl],
    phones: this.phones,
    locations: this.locations,
  });

  // The design suggests keeping the intro under 300 words
  private intro = toSignal(this.form.controls.contactText.valueChanges, { initialValue: '' });
  introWords = computed(() => this.intro().trim().split(/\s+/).filter(Boolean).length);

  constructor() {
    // Hide the "saved" message as soon as the admin edits something again
    this.form.valueChanges.subscribe(() => this.saved.set(false));
    this.reload();
  }

  // True when a field was touched and is invalid (works for any control or group)
  bad(group: AbstractControl, name: string): boolean {
    const control = group.get(name);
    return !!control && control.invalid && control.touched;
  }

  addPhone() {
    this.phones.push(this.newPhone());
    this.form.markAsDirty();
  }

  removePhone(index: number) {
    this.phones.removeAt(index);
    this.form.markAsDirty();
  }

  addLocation() {
    this.locations.push(this.newLocation());
    this.form.markAsDirty();
  }

  removeLocation(index: number) {
    this.locations.removeAt(index);
    this.form.markAsDirty();
  }

  // "إلغاء التغييرات" / "تراجع": go back to what the server has
  cancel() {
    this.fill(this.original());
    this.saveError.set(null);
    this.saved.set(false);
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const body: ContactInput = {
      email: v.email.trim(),
      contactText: v.contactText.trim(),
      workingDays: blankToNull(v.workingDays),
      workingTimes: blankToNull(v.workingTimes),
      extraNotes: blankToNull(v.extraNotes),
      facebookUrl: blankToNull(v.facebookUrl),
      xUrl: blankToNull(v.xUrl),
      whatsAppUrl: blankToNull(v.whatsAppUrl),
      // The design has no YouTube field, so keep what is already saved instead of wiping it
      youtubeUrl: this.original()?.youtubeUrl ?? null,
    phones: (v.phones as ContactPhone[]).map(p => ({ phone: p.phone.trim(), name: p.name.trim() })),
    locations: (v.locations as ContactLocation[]).map(l => ({
    locationName: l.locationName.trim(),
    address: l.address.trim(),
    mapUrl: blankToNull(l.mapUrl ?? ''),
    })),
    };

    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set(null);

    this.admin.saveContact(body).subscribe({
      next: () => {
        this.saving.set(false);
        this.reload(true); // read it back so "last update" is the server's time
      },
      error: err => {
        this.saveError.set(
          arabicError(err, {
            400: 'تعذر الحفظ، تأكد من عدم تكرار أرقام الهاتف أو أسماء المكاتب ومن صحة الروابط.',
            403: 'ليس لديك صلاحية لتعديل معلومات المكتب.',
          })
        );
        this.saving.set(false);
      },
    });
  }

  private reload(afterSave = false) {
    this.catalog.getContact().subscribe({
      next: info => {
        this.original.set(info);
        this.fill(info);
        this.loading.set(false);
        if (afterSave) this.saved.set(true);
      },
      error: err => {
        if (err.status === 404) {
          // Nothing saved yet: the form starts empty
          this.original.set(null);
          this.fill(null);
        } else if (afterSave) {
          this.saved.set(true); // it saved fine, only the refresh failed
        } else {
          this.loadError.set(arabicError(err));
        }
        this.loading.set(false);
      },
    });
  }

  private fill(info: ContactInfo | null) {
    this.phones.clear();
    this.locations.clear();
    info?.phones?.forEach(p => this.phones.push(this.newPhone(p)));
    info?.locations?.forEach(l => this.locations.push(this.newLocation(l)));

    this.form.patchValue({
      contactText: info?.contactText ?? '',
      email: info?.email ?? '',
      workingDays: info?.workingDays ?? '',
      workingTimes: info?.workingTimes ?? '',
      extraNotes: info?.extraNotes ?? '',
      facebookUrl: info?.facebookUrl ?? '',
      xUrl: info?.xUrl ?? '',
      whatsAppUrl: info?.whatsAppUrl ?? '',
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private newPhone(value?: ContactPhone): FormGroup {
    return this.fb.nonNullable.group({
      phone: [value?.phone ?? '', [Validators.required, Validators.maxLength(30)]],
      name: [value?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    });
  }

  private newLocation(value?: ContactLocation): FormGroup {
    return this.fb.nonNullable.group({
      locationName: [value?.locationName ?? '', [Validators.required]],
      address: [value?.address ?? '', [Validators.required]],
      mapUrl: [value?.mapUrl ?? '', optionalUrl],
    });
  }
}