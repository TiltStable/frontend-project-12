import { Anchor, Button, PasswordInput, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { logIn as logInRequest } from "../api.js";
import { useAuthStore } from "../store/context.js";

function LoginPage() {
  const { t } = useTranslation();
  const form = useForm({
    initialValues: { username: "", password: "" },
  });
  const [authError, setAuthError] = useState(null);
  const navigate = useNavigate();
  const logIn = useAuthStore((state) => state.logIn);

  const onSubmit = form.onSubmit(async (values) => {
    setAuthError(null);
    try {
      const { token, username } = await logInRequest(values);
      logIn({ token, username });
      navigate("/", { replace: true });
    } catch (error) {
      // The ladder keeps the root cause (status or payload) in `cause`.
      console.error("Login failed:", error.cause ?? error);
      // Static literals: dynamic keys (errors.${code}) would be dropped by
      // i18next-cli extract (removeUnusedKeys defaults to true).
      const errorTexts = {
        credentials: t("errors.credentials"),
        network: t("errors.network"),
      };
      setAuthError(
        Object.hasOwn(errorTexts, error.message) ? errorTexts[error.message] : errorTexts.network,
      );
    }
  });

  return (
    <section className="app">
      <Title order={1}>{t("login.title")}</Title>
      <form onSubmit={onSubmit}>
        <TextInput
          label={t("login.usernameLabel")}
          name="username"
          {...form.getInputProps("username")}
        />
        <PasswordInput
          label={t("login.passwordLabel")}
          name="password"
          {...form.getInputProps("password")}
        />
        {authError && <Text c="red">{authError}</Text>}
        <Button type="submit">{t("login.submit")}</Button>
      </form>
      <Anchor component={Link} to="/signup">
        {t("login.toSignupLink")}
      </Anchor>
    </section>
  );
}

export default LoginPage;
