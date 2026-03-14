import { supabase } from "@/lib/supabase";

export type SiteSettings = {
  id: string;
  site_name: string;
  site_subtitle: string;
  contact_email: string | null;
  contact_phone: string | null;
  naver_talk_url: string | null;
  show_free_courses_first: boolean;
  show_packages_first: boolean;
  enable_catalog: boolean;
  enable_classroom: boolean;
  enable_notices: boolean;
};

export async function fetchSiteSettings(): Promise<SiteSettings | null> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[site_settings load error]", error);
    return null;
  }

  return data as SiteSettings | null;
}