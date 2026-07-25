import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../../components/common/Avatar';
import MaterialIcon from '../../components/common/MaterialIcon';
import { userService } from '../../services/userService';
import { chatService } from '../../services/chatService';
import { resolveMediaUrl } from '../../utils/mediaUtils';
import { useToast } from '../../hooks/useToast';
import NotFoundState from '../../components/common/NotFoundState';
import { getUserFacingMessage, isNotFoundError } from '../../utils/errorUtils';

function Field({ label, children }) {
  return (
    <div className="py-3 border-b border-zinc-100 last:border-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm text-zinc-900">{children || <span className="text-zinc-400">—</span>}</dd>
    </div>
  );
}

function fullName(person) {
  return [person?.first_name, person?.last_name].filter(Boolean).join(' ') || 'Unknown';
}

export default function DirectoryProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setNotFound(false);
    setLoadError(false);
    userService
      .getDirectoryProfile(userId)
      .then((res) => setProfile(res.data?.data || null))
      .catch((err) => {
        setProfile(null);
        if (isNotFoundError(err)) {
          setNotFound(true);
          return;
        }
        setLoadError(true);
        if (!err?.isHandled) toast.error(getUserFacingMessage(err, 'Could not load profile'));
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleChat = async () => {
    if (!profile?.user_id || startingChat) return;
    setStartingChat(true);
    try {
      await chatService.createConversation(profile.user_id);
      navigate(`/people?userId=${profile.user_id}`);
    } catch (err) {
      if (!err?.isHandled) toast.error(getUserFacingMessage(err, 'Could not start chat'));
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-zinc-100 rounded-2xl" />
          <div className="h-64 bg-zinc-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <NotFoundState
        pageTitle="Directory"
        title="Profile not found"
        description="This profile does not exist or is no longer available."
        backTo="/org-chart"
        backLabel="Back to org chart"
      />
    );
  }
  if (loadError || !profile) {
    return (
      <NotFoundState
        pageTitle="Directory"
        title="Unable to load profile"
        description="Something went wrong while loading this profile."
        backTo="/org-chart"
        backLabel="Back to org chart"
      />
    );
  }

  const name = fullName(profile);
  const jobDept = [profile.profile?.job_title, profile.profile?.department_display]
    .filter(Boolean)
    .join(' · ');
  const company = profile.profile?.companyNode?.name || profile.profile?.company_name;
  const office = profile.profile?.officeNode?.name || profile.profile?.location;
  const manager = profile.profile?.manager;
  const reports = profile.direct_reports || [];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-lg">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-background mb-4"
      >
        <MaterialIcon name="arrow_back" className="text-[18px]" />
        Back
      </button>

      <div className="bg-white border border-outline-variant rounded-2xl p-6 mb-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <Avatar
            src={resolveMediaUrl(profile.avatar_url)}
            name={name}
            size="2xl"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-h1 text-h1 text-on-background tracking-tight">{name}</h1>
            {jobDept && (
              <p className="mt-1 text-sm text-secondary">{jobDept}</p>
            )}
            {profile.email && (
              <p className="mt-0.5 text-sm text-on-surface-variant">{profile.email}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              {profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-outline-variant text-on-background hover:bg-surface-container-low transition-colors"
                >
                  <MaterialIcon name="mail" className="text-[18px]" />
                  Email
                </a>
              )}
              <button
                type="button"
                onClick={handleChat}
                disabled={startingChat}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-primary text-on-primary hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <MaterialIcon name="chat" className="text-[18px]" />
                {startingChat ? 'Opening…' : 'Chat'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-outline-variant rounded-2xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-on-background mb-1">Profile</h2>
        <dl>
          <Field label="Job Title">{profile.profile?.job_title}</Field>
          <Field label="Department">{profile.profile?.department_display}</Field>
          <Field label="Company">{company}</Field>
          <Field label="Email">
            {profile.email ? (
              <a href={`mailto:${profile.email}`} className="text-primary font-medium hover:underline">
                {profile.email}
              </a>
            ) : null}
          </Field>
          <Field label="Phone">{profile.phone}</Field>
          <Field label="Mobile">{profile.mobile_phone}</Field>
          <Field label="Office Location">{office}</Field>
          <Field label="Manager">
            {manager ? (
              <Link
                to={`/directory/${manager.user_id}`}
                className="text-primary font-medium hover:underline"
              >
                {fullName(manager)}
              </Link>
            ) : null}
          </Field>
        </dl>
      </div>

      <div className="bg-white border border-outline-variant rounded-2xl p-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-on-background">Direct Reports</h2>
          <span className="text-xs text-on-surface-variant">
            {reports.length} {reports.length === 1 ? 'person' : 'people'}
          </span>
        </div>
        {reports.length === 0 ? (
          <p className="text-sm text-secondary">No direct reports.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {reports.map((r) => (
              <li key={r.user_id}>
                <Link
                  to={`/directory/${r.user_id}`}
                  className="flex items-center gap-3 py-3 hover:bg-surface-container-low -mx-2 px-2 rounded-lg transition-colors"
                >
                  <Avatar
                    src={resolveMediaUrl(r.avatar_url)}
                    name={fullName(r)}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-on-background truncate">{fullName(r)}</p>
                    {(r.job_title || r.department_display) && (
                      <p className="text-xs text-secondary truncate">
                        {[r.job_title, r.department_display].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <MaterialIcon name="chevron_right" className="text-zinc-400 text-[20px]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
