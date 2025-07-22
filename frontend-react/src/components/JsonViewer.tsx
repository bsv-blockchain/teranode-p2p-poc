import React, { useState, useCallback } from 'react';

interface JsonViewerProps {
  data: string;
  maxLines?: number;
  className?: string;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data, maxLines = 10, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatData = useCallback((rawData: string) => {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(rawData);
      return {
        formatted: JSON.stringify(parsed, null, 2),
        type: 'json',
        isValid: true
      };
    } catch {
      // Check if it's hex data
      if (/^[0-9a-fA-F]+$/.test(rawData) && rawData.length % 2 === 0) {
        return {
          formatted: rawData.replace(/(.{2})/g, '$1 ').trim(),
          type: 'hex',
          isValid: true
        };
      }
      
      // Check if it's base64
      if (/^[A-Za-z0-9+/]*={0,2}$/.test(rawData)) {
        try {
          const decoded = atob(rawData);
          return {
            formatted: decoded,
            type: 'base64',
            isValid: true
          };
        } catch {
          // Fall through to plain text
        }
      }
      
      // Default to plain text
      return {
        formatted: rawData,
        type: 'text',
        isValid: true
      };
    }
  }, []);

  const { formatted, type } = formatData(data);
  const lines = formatted.split('\n');
  const shouldTruncate = lines.length > maxLines;
  const displayLines = isExpanded ? lines : lines.slice(0, maxLines);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [formatted]);

  const getTypeColor = (dataType: string) => {
    switch (dataType) {
      case 'json': return 'bg-green-100 text-green-800';
      case 'hex': return 'bg-blue-100 text-blue-800';
      case 'base64': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSyntaxHighlighting = (content: string, dataType: string) => {
    if (dataType === 'json') {
      return content.replace(
        /(".*?"|'.*?'|[+-]?\d+\.?\d*|true|false|null)/g,
        (match) => {
          if (match.startsWith('"')) {
            return `<span class="text-green-600">${match}</span>`;
          } else if (/^[+-]?\d/.test(match)) {
            return `<span class="text-blue-600">${match}</span>`;
          } else if (['true', 'false', 'null'].includes(match)) {
            return `<span class="text-purple-600">${match}</span>`;
          }
          return match;
        }
      );
    }
    return content;
  };

  return (
    <div className={`relative group ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getTypeColor(type)}`}>
            {type.toUpperCase()}
          </span>
          <span className="text-xs text-gray-500">
            {lines.length} lines
          </span>
        </div>
        
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {shouldTruncate && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs px-2 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>
      
      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
        <pre className="text-sm text-gray-100 font-mono leading-relaxed">
          {type === 'json' ? (
            <div
              dangerouslySetInnerHTML={{
                __html: getSyntaxHighlighting(displayLines.join('\n'), type)
              }}
            />
          ) : (
            <code className={type === 'hex' ? 'tracking-wider' : ''}>
              {displayLines.join('\n')}
            </code>
          )}
        </pre>
        
        {shouldTruncate && !isExpanded && (
          <div className="mt-2 text-center">
            <button
              onClick={() => setIsExpanded(true)}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              ... show {lines.length - maxLines} more lines
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JsonViewer;