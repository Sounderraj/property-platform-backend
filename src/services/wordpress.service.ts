import { env } from '../config/env';
import { logger } from '../config/logger';
import { cacheDel, cacheDelPropertyKeys, cacheGet, cacheSetex } from '../utils/cache';

const PROPERTIES_CACHE_KEY = 'wp:properties:list';
const PROPERTY_CACHE_PREFIX = 'wp:property:';

export interface PropertySummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  price?: string;
  bedrooms?: number;
  location?: string;
}

const PROPERTIES_QUERY = `
  query GetProperties($first: Int!) {
    properties(first: $first, where: { status: PUBLISH }) {
      nodes {
        databaseId
        slug
        title
        excerpt
        ... on Property {
          price
          bedrooms
          location
        }
      }
    }
  }
`;

const PROPERTY_BY_SLUG_QUERY = `
  query GetProperty($slug: ID!) {
    property(id: $slug, idType: SLUG) {
      databaseId
      slug
      title
      content
      excerpt
      price
      bedrooms
      location
    }
  }
`;

export class WordPressService {
  private get graphqlUrl(): string {
    return env.WORDPRESS_GRAPHQL_URL ?? 'http://localhost:8080/graphql';
  }

  private async fetchGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`WordPress GraphQL HTTP ${response.status}`);
    }

    const json = (await response.json()) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };

    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join(', '));
    }

    return json.data as T;
  }

  private mapNode(node: Record<string, unknown>): PropertySummary {
    return {
      id: String(node.databaseId ?? ''),
      slug: String(node.slug ?? ''),
      title: String(node.title ?? ''),
      excerpt: String(node.excerpt ?? '').replace(/<[^>]*>/g, '').trim(),
      price: node.price ? String(node.price) : undefined,
      bedrooms: typeof node.bedrooms === 'number' ? node.bedrooms : undefined,
      location: node.location ? String(node.location) : undefined,
    };
  }

  private mockProperties(): PropertySummary[] {
    return [
      {
        id: '1',
        slug: 'luxury-apartment-london',
        title: 'Luxury Apartment - London',
        excerpt: 'Stunning 2-bed apartment in central London.',
        price: '£750,000',
        bedrooms: 2,
        location: 'London',
      },
      {
        id: '2',
        slug: 'family-home-manchester',
        title: 'Family Home - Manchester',
        excerpt: 'Spacious 4-bed detached home with garden.',
        price: '£425,000',
        bedrooms: 4,
        location: 'Manchester',
      },
    ];
  }

  async listProperties(first = 20, bypassCache = false): Promise<PropertySummary[]> {
    if (!bypassCache) {
      const cached = await cacheGet(PROPERTIES_CACHE_KEY);
      if (cached) return JSON.parse(cached) as PropertySummary[];
    }

    try {
      const data = await this.fetchGraphQL<{
        properties?: { nodes: Array<Record<string, unknown>> };
      }>(PROPERTIES_QUERY, { first });

      const properties = (data.properties?.nodes ?? []).map((n) => this.mapNode(n));

      if (properties.length > 0) {
        await cacheSetex(
          PROPERTIES_CACHE_KEY,
          env.WORDPRESS_CACHE_TTL_SECONDS,
          JSON.stringify(properties)
        );
      }

      return properties;
    } catch (err) {
      logger.warn({ err }, 'WordPress unavailable, using mock properties');
      const mock = this.mockProperties();
      await cacheSetex(PROPERTIES_CACHE_KEY, 60, JSON.stringify(mock));
      return mock;
    }
  }

  async getPropertyBySlug(slug: string, bypassCache = false): Promise<PropertySummary | null> {
    const cacheKey = `${PROPERTY_CACHE_PREFIX}${slug}`;

    if (!bypassCache) {
      const cached = await cacheGet(cacheKey);
      if (cached) return JSON.parse(cached) as PropertySummary;
    }

    try {
      const data = await this.fetchGraphQL<{
        property?: Record<string, unknown> | null;
      }>(PROPERTY_BY_SLUG_QUERY, { slug });

      if (!data.property) return null;

      const property = this.mapNode(data.property);
      await cacheSetex(cacheKey, env.WORDPRESS_CACHE_TTL_SECONDS, JSON.stringify(property));
      return property;
    } catch (err) {
      logger.warn({ err, slug }, 'WordPress property fetch failed');
      const mock = this.mockProperties().find((p) => p.slug === slug);
      if (mock) {
        await cacheSetex(cacheKey, 60, JSON.stringify(mock));
      }
      return mock ?? null;
    }
  }

  async invalidateCache(slug?: string): Promise<void> {
    await cacheDel(PROPERTIES_CACHE_KEY);
    if (slug) {
      await cacheDel(`${PROPERTY_CACHE_PREFIX}${slug}`);
    } else {
      await cacheDelPropertyKeys(PROPERTY_CACHE_PREFIX);
    }
  }
}

export const wordPressService = new WordPressService();
