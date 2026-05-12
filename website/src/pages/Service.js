import React from 'react';
import { LayoutDashboard, FileText, MessageSquare, Bell } from 'lucide-react';

const Service = () => {
  const services = [
    {
      title: 'Centralized Dashboard',
      description: 'A unified view of organizational metrics, quick links, and daily tasks tailored for both employees and administrators.',
      icon: LayoutDashboard,
      color: 'text-primary',
      bg: 'bg-primary-container',
    },
    {
      title: 'Document Management',
      description: 'Secure, organized, and easily searchable repository for all company policies, guidelines, and essential files.',
      icon: FileText,
      color: 'text-tertiary',
      bg: 'bg-tertiary-container',
    },
    {
      title: 'Internal Communications',
      description: 'Seamless chat, news feeds, and announcements to keep everyone aligned and informed across departments.',
      icon: MessageSquare,
      color: 'text-secondary',
      bg: 'bg-secondary-container',
    },
    {
      title: 'Real-time Notifications',
      description: 'Push notifications and alerts ensuring critical information reaches the right people instantly.',
      icon: Bell,
      color: 'text-error',
      bg: 'bg-error-container',
    },
  ];

  return (
    <div className="bg-background min-h-screen py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-display text-on-surface mb-4">Our Services</h1>
          <p className="text-h3 text-on-surface-variant max-w-2xl mx-auto">
            Comprehensive intranet solutions designed to elevate your organizational efficiency and employee engagement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {services.map((service, index) => (
            <div key={index} className="bg-surface-container-low rounded-2xl p-8 border border-outline-variant hover:border-primary transition-colors group">
              <div className="flex items-start gap-6">
                <div className={`p-4 rounded-xl ${service.bg} flex-shrink-0`}>
                  <service.icon className={`w-8 h-8 ${service.color}`} />
                </div>
                <div>
                  <h3 className="text-h2 text-on-surface mb-3 group-hover:text-primary transition-colors">{service.title}</h3>
                  <p className="text-body-lg text-on-surface-variant leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-20 bg-primary rounded-3xl p-10 text-center">
            <h2 className="text-h1 text-on-primary mb-4">Ready to transform your workplace?</h2>
            <p className="text-body-lg text-primary-fixed-dim mb-8 max-w-2xl mx-auto">
                Join organizations that are already leveraging BrightNOW to build better, more connected work environments.
            </p>
            <div className="flex justify-center gap-4">
                 <a href="/contact" className="px-6 py-3 bg-on-primary text-primary font-medium rounded-lg hover:bg-primary-container transition-colors">
                    Get in touch
                 </a>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Service;
