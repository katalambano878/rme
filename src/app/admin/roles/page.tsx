import { redirect } from 'next/navigation';

/** Role docs and the permission matrix now live on the Staff page. */
export default function AdminRolesRedirectPage() {
  redirect('/admin/staff');
}
