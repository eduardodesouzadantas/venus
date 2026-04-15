import "server-only";

import type {
  CatalogSourceAdapter,
  AdapterFetchResult,
  CanonicalProduct,
  CatalogQueryParams,
} from "./types";
import type { CatalogSource, InternalCatalogSourceConfig, CatalogSourceType } from "@/lib/tenant-config/types";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeProduct(
  raw: Record<string, unknown>,
  source: CatalogSource
): CanonicalProduct {
  return {
    id: String(raw.id || raw.product_id || ""),
    source_type: source.type,
    source_id: source.id,
    title: String(raw.name || raw.title || raw.product_name || "Produto"),
    description: String(raw.description || raw.description_text || raw.persuasive_description || ""),
    image_url: String(raw.image_url || raw.image || (raw.images as unknown[])?.[0] || ""),
    price: Number(raw.price || raw.price_amount || raw.price_range || 0),
    currency: String(raw.currency || "BRL"),
    colors: Array.isArray(raw.colors) ? raw.colors.map(String) : 
           raw.color ? [String(raw.color)] : [],
    sizes: Array.isArray(raw.sizes) ? raw.sizes.map(String) :
          raw.size ? [String(raw.size)] : [],
    category: String(raw.category || raw.product_category || "General"),
    style_tags: Array.isArray(raw.style_tags) ? raw.style_tags.map(String) :
               Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    availability: normalizeAvailability(raw),
    product_url: String(raw.product_url || raw.url || raw.external_url || ""),
    raw_metadata: raw,
  };
}

function normalizeAvailability(raw: Record<string, unknown>): "available" | "out_of_stock" | "limited" | "pre_order" {
  const stockStatus = String(raw.stock_status || raw.availability || "").toLowerCase();
  const stockQty = Number(raw.stock_qty || raw.stock || 0);
  
  if (stockStatus === "pre_order" || stockStatus === "preorder") return "pre_order";
  if (stockStatus === "out_of_stock" || stockStatus === "outofstock") return "out_of_stock";
  if (stockStatus === "limited" || stockQty > 0 && stockQty < 5) return "limited";
  if (stockQty > 0 || stockStatus === "available" || stockStatus === "in_stock") return "available";
  return "available";
}

function applyFilters(products: CanonicalProduct[], params: CatalogQueryParams): CanonicalProduct[] {
  let filtered = products;
  
  if (params.category) {
    filtered = filtered.filter(p => 
      p.category.toLowerCase().includes(params.category!.toLowerCase())
    );
  }
  
  if (params.color) {
    filtered = filtered.filter(p =>
      p.colors.some(c => c.toLowerCase().includes(params.color!.toLowerCase()))
    );
  }
  
  if (params.price_min !== undefined) {
    filtered = filtered.filter(p => p.price >= params.price_min!);
  }
  
  if (params.price_max !== undefined) {
    filtered = filtered.filter(p => p.price <= params.price_max!);
  }
  
  if (params.style) {
    filtered = filtered.filter(p =>
      p.style_tags.some(s => s.toLowerCase().includes(params.style!.toLowerCase()))
    );
  }
  
  if (params.occasion) {
    filtered = filtered.filter(p => {
      const meta = p.raw_metadata;
      const occasionTags = Array.isArray(meta?.occasion_tags) ? meta.occasion_tags : [];
      return occasionTags.some((o: string) => 
        String(o).toLowerCase().includes(params.occasion!.toLowerCase())
      );
    });
  }
  
  return filtered;
}

class InternalCatalogAdapter implements CatalogSourceAdapter {
  type: "internal" = "internal";

  async fetchProducts(
    source: CatalogSource,
    params: CatalogQueryParams
  ): Promise<AdapterFetchResult> {
    try {
      const config = source.config as InternalCatalogSourceConfig;
      const tableName = config.table_name || "products";
      
      const admin = createAdminClient();
      
      let query = admin.from(tableName).select("*").eq("org_id", params.org_id);
      
      if (config.filters) {
        if (config.filters.category) {
          query = query.eq("category", config.filters.category);
        }
        if (config.filters.style) {
          query = query.eq("style", config.filters.style);
        }
      }
      
      const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
      
      if (error) {
        return {
          success: false,
          products: [],
          error: error.message,
        };
      }
      
      const products = (data || []).map((raw) => normalizeProduct(raw, source));
      const filtered = applyFilters(products, params);
      
      return {
        success: true,
        products: filtered,
        raw_response: data,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        products: [],
        error: errorMessage,
      };
    }
  }

  getCatalogLink(source: CatalogSource): string {
    return "/catalog";
  }
}

class ExternalApiAdapter implements CatalogSourceAdapter {
  type: "external_api" = "external_api";

  async fetchProducts(
    source: CatalogSource,
    params: CatalogQueryParams
  ): Promise<AdapterFetchResult> {
    try {
      const config = source.config as {
        endpoint_url: string;
        auth_type: string;
        auth_config: Record<string, string>;
        headers?: Record<string, string>;
        timeout_ms?: number;
      };
      
      const url = new URL(config.endpoint_url);
      
      if (params.category) url.searchParams.append("category", params.category);
      if (params.color) url.searchParams.append("color", params.color);
      if (params.price_min) url.searchParams.append("price_min", String(params.price_min));
      if (params.price_max) url.searchParams.append("price_max", String(params.price_max));
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...config.headers,
      };
      
      if (config.auth_type === "bearer" && config.auth_config.token) {
        headers["Authorization"] = `Bearer ${config.auth_config.token}`;
      } else if (config.auth_type === "api_key" && config.auth_config.api_key) {
        headers["X-API-Key"] = config.auth_config.api_key;
      }
      
      const timeout = config.timeout_ms || 10000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return {
          success: false,
          products: [],
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      
      const data = await response.json();
      
      let products: CanonicalProduct[] = [];
      
      if (Array.isArray(data)) {
        products = data.map((item) => normalizeProduct(item, source));
      } else if (data.products && Array.isArray(data.products)) {
        products = data.products.map((item: Record<string, unknown>) => normalizeProduct(item, source));
      } else if (data.results && Array.isArray(data.results)) {
        products = data.results.map((item: Record<string, unknown>) => normalizeProduct(item, source));
      }
      
      const filtered = applyFilters(products, params);
      
      return {
        success: true,
        products: filtered,
        raw_response: data,
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return {
          success: false,
          products: [],
          error: "Request timeout",
        };
      }
      
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        products: [],
        error: errorMessage,
      };
    }
  }

  getCatalogLink(source: CatalogSource): string {
    const config = source.config as { endpoint_url?: string };
    try {
      const url = new URL(config.endpoint_url || "");
      return url.origin;
    } catch {
      return "/catalog";
    }
  }
}

class UrlFeedAdapter implements CatalogSourceAdapter {
  type: "url" = "url";

  async fetchProducts(
    source: CatalogSource,
    params: CatalogQueryParams
  ): Promise<AdapterFetchResult> {
    try {
      const config = source.config as {
        feed_url: string;
        format: "json" | "xml" | "csv";
        auth_config?: Record<string, string>;
      };
      
      const headers: Record<string, string> = {};
      
      if (config.auth_config?.api_key) {
        headers["X-API-Key"] = config.auth_config.api_key;
      }
      
      const response = await fetch(config.feed_url, {
        method: "GET",
        headers,
      });
      
      if (!response.ok) {
        return {
          success: false,
          products: [],
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      
      let products: CanonicalProduct[] = [];
      
      switch (config.format) {
        case "json": {
          const data = await response.json();
          if (Array.isArray(data)) {
            products = data.map((item) => normalizeProduct(item, source));
          } else if (data.products) {
            products = (data.products as Record<string, unknown>[]).map((item) => normalizeProduct(item, source));
          }
          break;
        }
        case "xml": {
          const xmlText = await response.text();
          products = this.parseXmlProducts(xmlText, source);
          break;
        }
        case "csv": {
          const csvText = await response.text();
          products = this.parseCsvProducts(csvText, source);
          break;
        }
      }
      
      const filtered = applyFilters(products, params);
      
      return {
        success: true,
        products: filtered,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        products: [],
        error: errorMessage,
      };
    }
  }

  private parseXmlProducts(xml: string, source: CatalogSource): CanonicalProduct[] {
    const products: CanonicalProduct[] = [];
    
    const productMatches = xml.matchAll(/<product[^>]*>([\s\S]*?)<\/product>/gi);
    
    for (const match of productMatches) {
      const xmlContent = match[1];
      
      const getTag = (tag: string): string => {
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
        const found = xmlContent.match(regex);
        return found ? found[1].trim() : "";
      };
      
      const raw: Record<string, unknown> = {
        id: getTag("id") || getTag("product_id") || getTag("sku"),
        name: getTag("name") || getTag("title") || getTag("product_name"),
        description: getTag("description") || getTag("desc"),
        price: parseFloat(getTag("price") || getTag("amount") || "0"),
        image: getTag("image") || getTag("image_url") || getTag("img"),
        url: getTag("url") || getTag("link") || getTag("product_url"),
        category: getTag("category") || getTag("cat"),
        colors: getTag("color") || getTag("colors"),
        sizes: getTag("size") || getTag("sizes"),
      };
      
      products.push(normalizeProduct(raw, source));
    }
    
    return products;
  }

  private parseCsvProducts(csv: string, source: CatalogSource): CanonicalProduct[] {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const products: CanonicalProduct[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const raw: Record<string, unknown> = {};
      
      headers.forEach((header, idx) => {
        raw[header] = values[idx]?.trim() || "";
      });
      
      products.push(normalizeProduct(raw, source));
    }
    
    return products;
  }

  getCatalogLink(source: CatalogSource): string {
    const config = source.config as { feed_url?: string };
    try {
      const url = new URL(config.feed_url || "");
      return url.origin;
    } catch {
      return "/catalog";
    }
  }
}

class WhatsAppCatalogAdapter implements CatalogSourceAdapter {
  type: "whatsapp" = "whatsapp";

  async fetchProducts(
    source: CatalogSource,
    params: CatalogQueryParams
  ): Promise<AdapterFetchResult> {
    return {
      success: false,
      products: [],
      error: "WhatsApp Catalog integration not yet implemented",
    };
  }

  getCatalogLink(source: CatalogSource): string {
    const config = source.config as { catalog_id?: string };
    return `https://business.facebook.com/catalog/${config.catalog_id || ""}`;
  }
}

const adapters: Record<CatalogSourceType, CatalogSourceAdapter> = {
  internal: new InternalCatalogAdapter(),
  external_api: new ExternalApiAdapter(),
  url: new UrlFeedAdapter(),
  whatsapp: new WhatsAppCatalogAdapter(),
};

export function getAdapter(type: CatalogSourceType): CatalogSourceAdapter {
  return adapters[type];
}

export function getAllAdapters(): CatalogSourceAdapter[] {
  return Object.values(adapters);
}