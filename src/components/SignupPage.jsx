import { Anchor, Button, PasswordInput, Text, TextInput, Title } from "@mantine/core";
import { hasLength, isNotEmpty, matchesField, useForm } from "@mantine/form";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { signUp as signUpRequest } from "../api.js";
import { useAuthStore } from "../store/auth.js";

function SignupPage() {
  const { t } = useTranslation();
  // The validators live inside the component: t must be bound to the
  // instance from useTranslation (the locale is static ru, so the form
  // config freezing them on the first render is harmless).
  // Library validators trim strings themselves, so the length checks agree
  // with the trimmed username the submit handler sends. Validators are
  // called at the value level: composing the validator functions themselves
  // (`isNotEmpty(...) ?? hasLength(...)`) short-circuits on the first
  // function object and silently drops the length rule.
  const required = isNotEmpty(t("validation.required"));
  const usernameLength = hasLength({ min: 3, max: 20 }, t("validation.length3to20"));
  const passwordLength = hasLength({ min: 6 }, t("validation.passwordLength"));
  const matchesPassword = matchesField("password", t("validation.passwordMismatch"));

  const form = useForm({
    initialValues: { username: "", password: "", confirmPassword: "" },
    validate: {
      username: (value) => required(value) ?? usernameLength(value),
      password: (value) => required(value) ?? passwordLength(value),
      confirmPassword: (value, values) => required(value) ?? matchesPassword(value, values),
    },
  });
  const [authError, setAuthError] = useState(null);
  const navigate = useNavigate();
  const logIn = useAuthStore((state) => state.logIn);
  const passwordProps = form.getInputProps("password");

  const onSubmit = form.onSubmit(async (values) => {
    setAuthError(null);
    try {
      const { token, username } = await signUpRequest({
        username: values.username.trim(),
        password: values.password,
      });
      logIn({ token, username });
      navigate("/", { replace: true });
    } catch (error) {
      // The ladder keeps the root cause (status or payload) in `cause`.
      console.error("Signup failed:", error.cause ?? error);
      // Static literals: dynamic keys would be dropped by i18next-cli
      // extract (removeUnusedKeys defaults to true).
      const errorTexts = {
        conflict: t("errors.conflict"),
        network: t("errors.network"),
      };
      setAuthError(
        Object.hasOwn(errorTexts, error.message) ? errorTexts[error.message] : errorTexts.network,
      );
    }
  });

  return (
    <section className="app">
      <Title order={1}>{t("signup.title")}</Title>
      <form onSubmit={onSubmit}>
        <TextInput
          label={t("signup.usernameLabel")}
          name="username"
          autoComplete="username"
          {...form.getInputProps("username")}
        />
        <PasswordInput
          label={t("signup.passwordLabel")}
          name="password"
          autoComplete="new-password"
          {...passwordProps}
          onChange={(event) => {
            passwordProps.onChange(event);
            // A stale mismatch error must not outlive the password it was
            // computed against (validation is otherwise submit-only).
            if (form.values.confirmPassword !== "") {
              form.validateField("confirmPassword");
            }
          }}
        />
        <PasswordInput
          label={t("signup.confirmLabel")}
          name="confirmPassword"
          autoComplete="new-password"
          {...form.getInputProps("confirmPassword")}
        />
        {authError && <Text c="red">{authError}</Text>}
        <Button type="submit" loading={form.submitting} disabled={form.submitting}>
          {t("signup.submit")}
        </Button>
      </form>
      <Anchor component={Link} to="/login">
        {t("signup.toLoginLink")}
      </Anchor>
    </section>
  );
}

export default SignupPage;
