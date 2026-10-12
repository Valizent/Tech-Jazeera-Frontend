/**
 * LoginPage — sign-in form inside the glassmorphic AuthLayout card.
 * react-hook-form + zodResolver handles validation; server errors render inline.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext.jsx';
import { loginSchema } from '../auth.schema.js';
import { apiMessage } from '../../../lib/utils.js';
import Input from '../../../components/ui/Input.jsx';
import Button from '../../../components/ui/Button.jsx';

export default function LoginPage() {
  const { t } = useTranslation();
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  // Already logged in? Go straight to the app.
  if (status === 'authed') return <Navigate to="/" replace />;

  async function onSubmit(values) {
    setServerError(null);
    try {
      await login(values);
      navigate('/', { replace: true });
    } catch (error) {
      setServerError(error.userMessage ?? apiMessage(error, t('auth.couldNotLogIn')));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 sm:gap-5">

      {/* Heading */}
      <div className="text-center">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-text">
          {t('auth.signIn')}
        </h1>
        <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-muted">{t('auth.useCompanyAccount')}</p>
      </div>

      {/* Fields */}
      <div className="space-y-3.5 sm:space-y-4">
        <Input
          label={t('auth.email')}
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label={t('auth.password')}
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
      </div>

      {/* Server error */}
      {serverError && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger/10 p-3 sm:p-3.5 text-xs sm:text-sm text-danger break-words">
          <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        isLoading={isSubmitting}
        className="mt-1 h-11 sm:h-12 w-full text-sm sm:text-base font-semibold shadow-glow"
      >
        {t('auth.signIn')}
      </Button>
    </form>
  );
}
