import { AppShell } from "@/components/AppShell";
import { ProfileForm } from "@/components/ProfileForm";
import { requireAccountUser } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await requireAccountUser();

  return (
    <AppShell user={user}>
      <div className="content profile-page">
        <header className="profile-page-head">
          <span className="profile-page-kicker">Личная карточка</span>
          <h1>Изменить профиль</h1>
          <p>Заполните карточку, которую коллеги увидят по нажатию на ваш аватар в комментариях.</p>
        </header>
        <ProfileForm user={{
          id: user.id,
          name: user.name,
          lastName: user.lastName,
          firstName: user.firstName,
          middleName: user.middleName,
          email: user.email,
          jobTitle: user.jobTitle,
          handle: user.handle,
          profileStatus: user.profileStatus,
          currentActivity: user.currentActivity,
          lastActiveAt: user.lastActiveAt,
          avatarUrl: user.avatarUrl,
        }} />
      </div>
    </AppShell>
  );
}
