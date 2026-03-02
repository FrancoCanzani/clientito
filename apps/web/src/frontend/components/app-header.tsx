import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useRouterState } from "@tanstack/react-router";

function getSectionName(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const section = segments[0];
  if (section === "emails") return "Emails";
  if (section === "people") return "People";
  if (section === "companies") return "Companies";
  if (section === "tasks") return "Tasks";
  return "Home";
}

export default function AppHeader() {
  const pathname = useRouterState().location.pathname;
  const sectionName = getSectionName(pathname);

  return (
    <header className="sticky top-0 z-50 bg-background">
      <div className="mx-auto flex max-w-4xl items-center px-4 py-3 text-sm">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-lg font-medium">
                Clientito
              </BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{sectionName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
