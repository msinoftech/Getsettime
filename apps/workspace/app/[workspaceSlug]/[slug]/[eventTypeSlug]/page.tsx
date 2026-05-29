import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import EmbedBookingForm from '@/src/components/Booking/EmbedBookingForm';
import {
  get_embed_event_type_by_slug,
  get_embed_service_provider_id_by_link_slug,
  get_embed_workspace_by_slug,
} from '@/lib/embed_booking_page';

interface PageProps {
  params: Promise<{
    workspaceSlug: string;
    slug: string;
    eventTypeSlug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { workspaceSlug, eventTypeSlug } = await params;
  const workspace = await get_embed_workspace_by_slug(workspaceSlug);

  if (!workspace) {
    return { title: 'Workspace Not Found' };
  }

  const eventType = await get_embed_event_type_by_slug(workspace.id, eventTypeSlug);

  return {
    title: `Book ${eventType?.title || 'Appointment'} with ${workspace.name}`,
    description: `Schedule a ${eventType?.title || 'booking'} with ${workspace.name}`,
  };
}

export default async function ProviderEventTypeEmbedPage({ params }: PageProps) {
  const { workspaceSlug, slug, eventTypeSlug } = await params;
  const workspace = await get_embed_workspace_by_slug(workspaceSlug);

  if (!workspace) {
    notFound();
  }

  const serviceProviderId = await get_embed_service_provider_id_by_link_slug(
    workspace.id,
    slug
  );

  if (!serviceProviderId) {
    notFound();
  }

  const eventType = await get_embed_event_type_by_slug(workspace.id, eventTypeSlug);

  if (!eventType) {
    notFound();
  }

  if (eventType.owner_id && eventType.owner_id !== serviceProviderId) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <EmbedBookingForm
        workspace={workspace}
        serviceProviderId={serviceProviderId}
        eventTypeSlug={eventType.slug}
      />
    </div>
  );
}
