import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { arabicError } from '../../shared/utils/errors';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        if (this.auth.isAdmin()) {
          this.router.navigateByUrl('/admin/orders');
        } else {
          this.auth.logout();
          this.error.set('هذا الحساب لا يملك صلاحية الدخول إلى لوحة الإدارة.');
          this.loading.set(false);
        }
      },
      error: err => {
        this.error.set(
          arabicError(err, {
            400: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
            404: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
          })
        );
        this.loading.set(false);
      },
    });
  }
}