import React from 'react';
import { useWorker } from '../../src/lib/session';
import { ScreenBody, PageHeader } from '../../src/components/Screen';
import { ProfileEditor } from '../../src/components/ProfileEditor';

/**
 * Profile completion. Same controls as the Profile tab, framed as a checklist
 * for a worker who just logged in with supervisor-issued temp credentials.
 */
export default function OnboardingScreen() {
  const worker = useWorker();

  return (
    <ScreenBody>
      <PageHeader
        eyebrow="Step 1 of 1"
        title={`Welcome, ${worker.full_name.split(' ')[0]}`}
        sub="Two things and you're set up: a face scan and a valid ID."
      />
      <ProfileEditor worker={worker} onboarding />
    </ScreenBody>
  );
}
