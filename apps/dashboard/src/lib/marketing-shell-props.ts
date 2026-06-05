import type { ModuleFlags } from "$lib/module-flags-types";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import { SUITE_MODULES, type SuiteModule } from "$lib/suite/suite-modules";
import { absoluteUrl } from "$lib/seo";

/** Props for {@link SuiteMarketingLayout} from a route layout (`$page` is valid there only). */
export type MarketingShellProps = {
  user: App.PageData["user"] | undefined;
  pathname: string;
  ogUrl: string;
  moduleFlags: ModuleFlags;
  suiteModulesForUi: SuiteModule[];
};

export function marketingShellPropsFromPage(page: {
  data: {
    user?: App.PageData["user"];
    moduleFlags?: ModuleFlags;
    suiteModulesForUi?: SuiteModule[];
  };
  url: URL;
}): MarketingShellProps {
  const pathname = page.url.pathname;
  return {
    user: page.data.user,
    pathname,
    ogUrl: absoluteUrl(page.url, pathname),
    moduleFlags: page.data.moduleFlags ?? MVP_MODULE_DEFAULTS,
    suiteModulesForUi: page.data.suiteModulesForUi ?? SUITE_MODULES,
  };
}
