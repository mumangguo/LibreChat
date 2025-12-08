import React, { useEffect } from 'react';
import TagManager from 'react-gtm-module';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';

export default function Footer({ className }: { className?: string }) {
  const { data: config } = useGetStartupConfig();
  const localize = useLocalize();

  const footerLines = [
    'AI 每日朋友圈',
    '浙ICP备2021031999号-3  Copyright © 2025-2026 by www.aipyq.com. all rights reserved',
  ];

  useEffect(() => {
    if (config?.analyticsGtmId != null && typeof window.google_tag_manager === 'undefined') {
      const tagManagerArgs = {
        gtmId: config.analyticsGtmId,
      };
      TagManager.initialize(tagManagerArgs);
    }
  }, [config?.analyticsGtmId]);

  return (
    <div className="relative w-full">
      <div
        className={
          className ??
          'absolute bottom-0 left-0 right-0 hidden px-2 py-2 text-center text-xs text-text-primary sm:block md:px-[60px]'
        }
        role="contentinfo"
      >
        {footerLines.map((line, index) => (
          <div key={`footer-line-${index}`} className="leading-relaxed">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
