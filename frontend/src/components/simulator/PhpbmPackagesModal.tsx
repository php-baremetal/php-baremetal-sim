/**
 * "Add library" for a php-baremetal project (php-baremetal fork).
 *
 * Lists the user-facing packages of repository.php-baremetal.com (extensions,
 * drivers, PHP extensions — via the backend's /api/phpbm/packages proxy) and
 * adds/removes them in the board's composer.json `require`. The next Run
 * rebuilds through /api/phpbm: a package set never seen before builds a new
 * PHP engine once (cached per lock), afterwards it is instant.
 *
 * Same look as the Library Manager (its CSS classes), rendered by
 * LibraryManagerModal when the active board is a php-baremetal project.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import {
  addRequire,
  fetchPhpbmPackages,
  removeRequire,
  requiredPackages,
  type PhpbmPackage,
} from '../../services/phpbmPackages';

const KIND_LABEL: Record<string, string> = {
  'bm-ext': 'extension',
  'bm-lib': 'driver',
  'bm-php-ext': 'PHP extension',
};

interface Props {
  groupId: string;
  boardLabel: string;
  onClose: () => void;
}

export const PhpbmPackagesModal: React.FC<Props> = ({ groupId, boardLabel, onClose }) => {
  const composerFile = useEditorStore((s) =>
    (s.fileGroups[groupId] ?? []).find((f) => f.name === 'composer.json'),
  );
  const [packages, setPackages] = useState<PhpbmPackage[] | null>(null);
  const [registry, setRegistry] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPhpbmPackages()
      .then((r) => {
        if (!alive) return;
        setPackages(r.packages);
        setRegistry(r.registry);
      })
      .catch((e) => alive && setStatus({ type: 'error', text: String(e.message ?? e) }));
    return () => {
      alive = false;
    };
  }, []);

  const required = useMemo(
    () => (composerFile ? requiredPackages(composerFile.content) : {}),
    [composerFile],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (packages ?? []).filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    );
  }, [packages, query]);

  const edit = (next: (json: string) => string, done: string) => {
    if (!composerFile) return;
    try {
      const content = next(composerFile.content);
      const ed = useEditorStore.getState();
      ed.setGroupFileContent(groupId, composerFile.id, content);
      // A package change is a code change: the next Run rebuilds.
      useEditorStore.setState({ codeChangedSinceLastCompile: true });
      setStatus({ type: 'success', text: done });
    } catch (e) {
      setStatus({ type: 'error', text: (e as Error).message });
    }
  };

  return (
    <div className="lib-modal-overlay" onClick={onClose}>
      <div className="lib-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lib-modal-header">
          <div className="lib-modal-title">
            <span>php-baremetal packages</span>
            <span
              title="Packages go into this board's composer.json (require)"
              style={{
                marginLeft: 8,
                fontSize: 11,
                color: 'var(--color-feedback-success)',
                background: 'var(--color-feedback-success-soft)',
                border: '1px solid #2e7d32',
                borderRadius: 10,
                padding: '1px 8px',
              }}
            >
              {boardLabel} · composer.json
            </span>
          </div>
          <button className="lib-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="lib-search-bar">
          <input
            type="text"
            placeholder="Filter packages (gpio, i2c, mbstring, ws2812…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {status && <div className={`lib-status ${status.type}`}>{status.text}</div>}

        <div className="lib-content">
          <div className="lib-list">
            <div className="lib-empty" style={{ padding: '10px 14px 4px' }}>
              <p className="lib-empty-sub" style={{ margin: 0 }}>
                A package is a line in composer.json&apos;s <code>require</code>, as{' '}
                <code>composer require</code> writes it. The next Run builds the firmware with
                it: a new set of packages takes a few minutes the first time, then it is cached.
                {registry && <> Packages from {registry}.</>}
              </p>
            </div>
            {!composerFile && (
              <div className="lib-empty">
                <p>This board has no composer.json.</p>
              </div>
            )}
            {composerFile && packages === null && !status && (
              <div className="lib-empty">
                <p>Loading packages…</p>
              </div>
            )}
            {composerFile &&
              rows.map((p) => {
                const inProject = p.name in required;
                return (
                  <div key={p.name} className="lib-item">
                    <div className="lib-item-info">
                      <div className="lib-item-header">
                        <span className="lib-item-name">{p.name.replace(/^php-baremetal\//, '')}</span>
                        <span className="lib-item-version">{KIND_LABEL[p.type] ?? p.type}</span>
                      </div>
                      {p.description && <p className="lib-item-desc">{p.description}</p>}
                    </div>
                    <div className="lib-item-actions">
                      <span className="lib-item-version">{inProject ? required[p.name] : p.version}</span>
                      {inProject ? (
                        <button
                          className="lib-uninstall-btn"
                          onClick={() => edit((j) => removeRequire(j, p.name), `${p.name} removed from composer.json`)}
                          title="Remove it from composer.json's require"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          className="lib-install-btn"
                          onClick={() =>
                            edit(
                              (j) => addRequire(j, p.name, p.constraint),
                              `${p.name} ${p.constraint} added to composer.json — press Run to build`,
                            )
                          }
                          title={`composer require ${p.name}:${p.constraint}`}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};
