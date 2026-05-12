import React from 'react';
import { Target, Lightbulb, TrendingUp } from 'lucide-react';

const About = () => {
  return (
    <div className="bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-display text-on-surface mb-4">About BrightNOW</h1>
          <p className="text-h3 text-on-surface-variant max-w-3xl mx-auto">
            We are dedicated to building professional, slick, and highly functional digital environments for modern organizations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24">
          <div>
            <h2 className="text-h1 text-on-surface mb-6">Our Mission</h2>
            <p className="text-body-lg text-on-surface-variant mb-4">
              At BrightNOW, we believe that an organization's most valuable asset is its people. Our mission is to create a unified digital workplace that brings teams together, regardless of their physical location.
            </p>
            <p className="text-body-lg text-on-surface-variant">
              We focus on delivering slick, clean, and intuitive interfaces that reduce friction in daily tasks and empower employees to focus on what they do best. By adhering to modern design principles, we ensure our platforms are not just functional, but a joy to use.
            </p>
          </div>
          <div className="bg-surface-container rounded-2xl p-8 border border-outline-variant h-full flex flex-col justify-center">
             <div className="grid grid-cols-1 gap-8">
                <div className="flex items-start gap-4">
                  <div className="bg-primary-container p-3 rounded-lg">
                     <Target className="text-primary w-6 h-6"/>
                  </div>
                  <div>
                    <h4 className="text-h3 text-on-surface mb-1">Precision</h4>
                    <p className="text-body-sm text-on-surface-variant">Targeted solutions designed for enterprise needs.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-tertiary-container p-3 rounded-lg">
                     <Lightbulb className="text-tertiary w-6 h-6"/>
                  </div>
                  <div>
                    <h4 className="text-h3 text-on-surface mb-1">Innovation</h4>
                    <p className="text-body-sm text-on-surface-variant">Forward-thinking features that keep you ahead.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary-fixed p-3 rounded-lg">
                     <TrendingUp className="text-on-primary-fixed w-6 h-6"/>
                  </div>
                  <div>
                    <h4 className="text-h3 text-on-surface mb-1">Growth</h4>
                    <p className="text-body-sm text-on-surface-variant">Scalable architecture built for expanding teams.</p>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
