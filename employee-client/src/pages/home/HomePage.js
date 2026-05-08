import React from 'react';
import HeroAndToday from './HeroAndToday';
import QuickAccessGrid from './QuickAccessGrid';
import MainContentGrid from './MainContentGrid';
import BottomRow from './BottomRow';

export default function HomePage() {
  return (
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-lg lg:py-unit-xl space-y-unit-lg lg:space-y-unit-xxl">
      <HeroAndToday />
      <QuickAccessGrid />
      <MainContentGrid />
      <BottomRow />
    </div>
  );
}
