import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section className="app">
      <h1>{t("notFound.title")}</h1>
      <Link to="/">{t("notFound.homeLink")}</Link>
    </section>
  );
}

export default NotFoundPage;
