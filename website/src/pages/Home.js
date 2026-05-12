import React from 'react';
import { ArrowRight, Users, Shield, Zap } from 'lucide-react';
import { EMPLOYEE_PORTAL_URL, ADMIN_PORTAL_URL } from '../config/portals';

const Home = () => {
  return (
    <div className="bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-surface-container-lowest border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-display font-display text-on-surface mb-6">
              Empower Your Workforce with BrightNOW
            </h1>
            <p className="text-h3 text-on-surface-variant font-normal mb-10">
              The modern intranet solution designed to connect, engage, and inspire your team, all in one professional platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={EMPLOYEE_PORTAL_URL}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-body-lg font-medium rounded-lg text-on-primary bg-primary hover:bg-on-primary-fixed transition-colors"
              >
                Employee Portal
                <ArrowRight className="ml-2 -mr-1 h-5 w-5" aria-hidden="true" />
              </a>
              <a
                href={ADMIN_PORTAL_URL}
                className="inline-flex items-center justify-center px-6 py-3 border-2 border-primary text-body-lg font-medium rounded-lg text-primary bg-transparent hover:bg-primary-container transition-colors"
              >
                Admin Dashboard
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Preview Section */}
      <section className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-h1 text-on-surface mb-4">Everything you need to succeed</h2>
            <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              Built with modern teams in mind, BrightNOW provides all the tools required for seamless organizational management.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary-container rounded-lg flex items-center justify-center mb-6">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-h2 text-on-surface mb-3">Team Connectivity</h3>
              <p className="text-body-md text-on-surface-variant">
                Break down silos and foster collaboration with intuitive communication channels and shared resources.
              </p>
            </div>

            <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-tertiary-container rounded-lg flex items-center justify-center mb-6">
                <Zap className="h-6 w-6 text-tertiary" />
              </div>
              <h3 className="text-h2 text-on-surface mb-3">Efficient Workflows</h3>
              <p className="text-body-md text-on-surface-variant">
                Streamline daily operations with automated processes and integrated tooling designed for speed.
              </p>
            </div>

            <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-error-container rounded-lg flex items-center justify-center mb-6">
                <Shield className="h-6 w-6 text-error" />
              </div>
              <h3 className="text-h2 text-on-surface mb-3">Enterprise Security</h3>
              <p className="text-body-md text-on-surface-variant">
                Rest easy knowing your organizational data is protected by industry-leading security protocols.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
