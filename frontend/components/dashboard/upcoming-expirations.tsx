'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardContent, Spinner } from '@/components/ui';
import { ExpirationIndicator } from './expiration-indicator';
import {
  fetchExpiringItems,
  type ExpiringItem,
  type ExpiringItemsResponse,
} from '@/lib/api/admin';
import Link from 'next/link';

interface UpcomingExpirationsProps {
  limit?: number;
}

export function UpcomingExpirations({ limit = 10 }: UpcomingExpirationsProps) {
  const { getToken } = useAuth();
  const [data, setData] = useState<ExpiringItemsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getToken();
        const result = await fetchExpiringItems(token, { days: 30, limit });
        if (mounted) setData(result);
      } catch {
        // silently fail — widget is supplemental
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getToken, limit]);

  const totalItems =
    (data?.expiringSoon.length || 0) + (data?.expired.length || 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-800">
              Upcoming Expirations
            </h3>
            {totalItems > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {totalItems}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : totalItems === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            No upcoming expirations in the next 30 days.
          </p>
        ) : (
          <div className="space-y-1">
            {/* Expired items first */}
            {data?.expired.map((item) => (
              <ExpirationRow key={item.id} item={item} isExpired />
            ))}

            {/* Expiring soon */}
            {data?.expiringSoon.map((item) => (
              <ExpirationRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExpirationRow({
  item,
  isExpired,
}: {
  item: ExpiringItem;
  isExpired?: boolean;
}) {
  const clinicianName = `${item.clinician.firstName} ${item.clinician.lastName}`;

  return (
    <Link
      href={`/dashboard/clinicians/${item.clinician.id}`}
      className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <ExpirationIndicator
          expiresAt={item.expiresAt}
          daysRemaining={isExpired ? 0 : item.daysRemaining}
          showLabel={false}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 truncate">
            {item.label}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {clinicianName} &middot; {item.clinician.discipline}
            {item.blocking && (
              <span className="text-red-500 ml-1">(blocking)</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ExpirationIndicator
          expiresAt={item.expiresAt}
          daysRemaining={isExpired ? 0 : item.daysRemaining}
        />
        <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}
