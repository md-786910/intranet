import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Placeholder for form submission
    console.log('Form submitted:', formData);
    alert('Thank you for contacting us. We will get back to you shortly.');
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <div className="bg-background min-h-screen py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-display text-on-surface mb-4">Contact Us</h1>
          <p className="text-h3 text-on-surface-variant max-w-2xl mx-auto">
            Have questions about BrightNOW? Our team is here to help you build the perfect intranet for your organization.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact Information */}
          <div>
            <h2 className="text-h1 text-on-surface mb-8">Get in Touch</h2>
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-container rounded-lg">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-h3 text-on-surface mb-1">Email</h3>
                  <p className="text-body-md text-on-surface-variant mb-1">For general inquiries and support.</p>
                  <a href="mailto:hello@brightnow.app" className="text-body-md font-medium text-primary hover:underline">hello@brightnow.app</a>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-tertiary-container rounded-lg">
                  <Phone className="w-6 h-6 text-tertiary" />
                </div>
                <div>
                  <h3 className="text-h3 text-on-surface mb-1">Phone</h3>
                  <p className="text-body-md text-on-surface-variant mb-1">Mon-Fri from 9am to 6pm.</p>
                  <a href="tel:+1234567890" className="text-body-md font-medium text-primary hover:underline">+1 (555) 123-4567</a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-secondary-container rounded-lg">
                  <MapPin className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="text-h3 text-on-surface mb-1">Office</h3>
                  <p className="text-body-md text-on-surface-variant mb-1">Come visit our headquarters.</p>
                  <p className="text-body-md text-on-surface-variant">123 Business Avenue<br/>Tech District, Innovation City 10001</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-surface-container rounded-2xl p-8 border border-outline-variant shadow-sm">
            <h2 className="text-h2 text-on-surface mb-6">Send us a message</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-body-sm font-medium text-on-surface mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-outline-variant rounded-md bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-body-sm font-medium text-on-surface mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-outline-variant rounded-md bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-body-sm font-medium text-on-surface mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows="5"
                  className="w-full px-4 py-2 border border-outline-variant rounded-md bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow resize-none"
                  placeholder="How can we help you?"
                ></textarea>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-on-primary rounded-md font-medium hover:bg-on-primary-fixed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Send Message
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
