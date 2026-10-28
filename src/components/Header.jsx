import { Anchor, Button, Group } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { useAuthStore } from "../store/auth.js";
import { useUiStore } from "../store/ui.js";

// The logout invariant lives here: session store, session UI state and the
// query cache (the previous user's channels/messages) must not outlive the
// session. The explicit navigate covers non-chat pages, where the "/" guard
// does not fire.
function Header() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogOut = () => {
    useAuthStore.getState().logOut();
    useUiStore.setState({ currentChannelId: null, modal: null });
    navigate("/login", { replace: true });
    queryClient.clear();
  };

  return (
    <header>
      <Group justify="space-between" p="md" pb="xs">
        <Anchor component={Link} to="/" fw="bold" size="lg">
          {t("app.title")}
        </Anchor>
        {token && (
          <Button variant="subtle" onClick={handleLogOut}>
            {t("header.logout")}
          </Button>
        )}
      </Group>
    </header>
  );
}

export default Header;
