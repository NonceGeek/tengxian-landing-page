"use client";
import { X } from 'lucide-react';
import { type Dictionary } from '../i18n/types';

interface WeChatQRCodeModalProps {
  dict: Dictionary;
}

export default function WeChatQRCodeModal({ dict }: WeChatQRCodeModalProps) {
  return (
    <div className="space-y-4 text-center">
      <h4 className="text-lg font-semibold text-primary">{dict.footer.wechat.title}</h4>
      <p className="text-sm text-base-content/70">{dict.footer.wechat.description}</p>
      <a href="https://x.com/rootMUD" target="_blank" rel="noopener noreferrer">
        <button className="btn btn-primary btn-sm">
          <X className="w-4 h-4" /> 👈
        </button>
      </a>
    </div>
  );
} 