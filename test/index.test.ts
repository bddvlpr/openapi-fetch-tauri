import { Mock, afterEach, describe, expect, test, vi } from 'vitest';
import createClient, { MiddlewareRequest, QuerySerializerOptions } from '../src/index.js';
import type { paths } from './fixtures/api.js';
import { Response } from '@tauri-apps/api/http';

const mockResponseOnce = (
  fetch: Mock,
  status: number,
  data: unknown,
  headers?: Record<string, string>
) => {
  fetch.mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    headers: headers ?? {},
    data
  });
};

const mockResponse = (
  fetch: Mock,
  status: number,
  data: unknown,
  headers?: Record<string, string>
) => {
  fetch.mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    headers: headers ?? {},
    data
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('client', () => {
  test('generates all proper functions', () => {
    const client = createClient<paths>();

    expect(client).toHaveProperty('GET');
    expect(client).toHaveProperty('PUT');
    expect(client).toHaveProperty('POST');
    expect(client).toHaveProperty('DELETE');
    expect(client).toHaveProperty('OPTIONS');
    expect(client).toHaveProperty('HEAD');
    expect(client).toHaveProperty('PATCH');
    expect(client).toHaveProperty('TRACE');
  });

  describe('ts checks', () => {
    test('marks data or error as undefined, but never both', async () => {
      const fetch = vi.fn();
      const client = createClient<paths>({ fetch });

      // data
      mockResponseOnce(fetch, 200, ['one', 'two', 'three']);

      const dataRes = await client.GET('/string-array');

      // @ts-expect-error dataRes is possibly undefined
      expect(dataRes.data[0]).toBe('one');

      // is present if error is undefined
      if (!dataRes.error) {
        expect(dataRes.data[0]).toBe('one');
      }

      // means data is undefined
      if (dataRes.data) {
        // @ts-expect-error data is undefined
        expect(() => dataRes.error.message).toThrow();
      }

      // error
      mockResponseOnce(fetch, 500, { message: 'Something went wrong' });

      const errorRes = await client.GET('/string-array');

      // @ts-expect-error errorRes is possibly undefined
      expect(errorRes.error.message).toBe('Something went wrong');

      // is present if data is undefined
      if (!errorRes.data) {
        expect(errorRes.error.message).toBe('Something went wrong');
      }

      // means error is undefined
      if (errorRes.error) {
        // @ts-expect-error error is undefined
        expect(() => errorRes.data[0]).toThrow();
      }
    });

    describe('params', () => {
      describe('path', () => {
        test('typechecks', async () => {
          const fetch = vi.fn();
          const client = createClient<paths>({ baseUrl: 'https://myapi.com/v1', fetch });
          mockResponse(fetch, 200, { message: 'Success' });

          // @ts-expect-error expect error on missing 'params'
          await client.GET('/blogposts/{post_id}');

          // @ts-expect-error expect error on empty params
          await client.GET('/blogposts/{post_id}', { params: {} });

          // @ts-expect-error expect error on empty params.path
          await client.GET('/blogposts/{post_id}', { params: { path: {} } });

          // @ts-expect-error expect error on missing 'post_id'
          await client.GET('/blogposts/{post_id}', { params: { path: { post_id: 1234 } } });

          // (no error)
          await client.GET('/blogposts/{post_id}', { params: { path: { post_id: '1234' } } });

          // expect param passed correctly
          const lastCall = fetch.mock.calls[fetch.mock.calls.length - 1];
          expect(lastCall[0]).toBe('https://myapi.com/v1/blogposts/1234');
        });

        test('serializes', async () => {
          const fetch = vi.fn();
          const client = createClient<paths>({ fetch });
          mockResponse(fetch, 200, { message: 'Success' });

          await client.GET(
            '/path-params/{simple_primitive}/{simple_obj_flat}/{simple_arr_flat}/{simple_obj_explode*}/{simple_arr_explode*}/{.label_primitive}/{.label_obj_flat}/{.label_arr_flat}/{.label_obj_explode*}/{.label_arr_explode*}/{;matrix_primitive}/{;matrix_obj_flat}/{;matrix_arr_flat}/{;matrix_obj_explode*}/{;matrix_arr_explode*}',
            {
              params: {
                path: {
                  simple_primitive: 'simple',
                  simple_obj_flat: { a: 'b', c: 'd' },
                  simple_arr_flat: [1, 2, 3],
                  simple_obj_explode: { e: 'f', g: 'h' },
                  simple_arr_explode: [4, 5, 6],
                  label_primitive: 'label',
                  label_obj_flat: { a: 'b', c: 'd' },
                  label_arr_flat: [1, 2, 3],
                  label_obj_explode: { e: 'f', g: 'h' },
                  label_arr_explode: [4, 5, 6],
                  matrix_primitive: 'matrix',
                  matrix_obj_flat: { a: 'b', c: 'd' },
                  matrix_arr_flat: [1, 2, 3],
                  matrix_obj_explode: { e: 'f', g: 'h' },
                  matrix_arr_explode: [4, 5, 6]
                }
              }
            }
          );
          const reqURL = fetch.mock.calls[0][0];
          expect(reqURL).toBe(
            `/path-params/${[
              // simple
              'simple',
              'a,b,c,d',
              '1,2,3',
              'e=f,g=h',
              '4,5,6',
              // label
              '.label',
              '.a,b,c,d',
              '.1,2,3',
              '.e=f.g=h',
              '.4.5.6',
              // matrix
              ';matrix_primitive=matrix',
              ';matrix_obj_flat=a,b,c,d',
              ';matrix_arr_flat=1,2,3',
              ';e=f;g=h',
              ';matrix_arr_explode=4;matrix_arr_explode=5;matrix_arr_explode=6'
            ].join('/')}`
          );
        });

        test('allows UTF-8 characters', async () => {
          const fetch = vi.fn();
          const client = createClient<paths>({ fetch });
          mockResponseOnce(fetch, 200, { message: 'Success' });
          await client.GET('/blogposts/{post_id}', {
            params: { path: { post_id: 'post?id = 🥴' } }
          });

          // expect post_id to be encoded properly
          // TOOD: this might be incorrect, will check up on this later
          expect(fetch.mock.calls[0][0]).toBe(`/blogposts/post?id = 🥴`);
        });

        test('header', async () => {
          const fetch = vi.fn();
          const client = createClient<paths>({ fetch });
          mockResponse(fetch, 200, { message: 'Success' });

          // @ts-expect-error expect error on empty params
          await client.GET('/header-params');

          await client.GET('/header-params', {
            // @ts-expect-error expect error on incorrect params.header
            params: { header: { foo: 'bar' } }
          });

          await client.GET('/header-params', {
            // @ts-expect-error expect error on mismatched type
            params: { header: { 'x-required-header': true } }
          });

          // (no error)
          await client.GET('/header-params', {
            params: { header: { 'x-required-header': 'correct' } }
          });

          const lastCall = fetch.mock.calls[fetch.mock.calls.length - 1];
          expect(lastCall[1].headers['x-required-header']).toEqual('correct');
        });

        describe('query', () => {
          describe('querySerializer', () => {
            test('primitives', async () => {
              const fetch = vi.fn();
              const client = createClient<paths>({ fetch });
              mockResponseOnce(fetch, 200, { message: 'Success' });
              await client.GET('/query-params', {
                params: {
                  query: { string: 'string', number: 0, boolean: false }
                }
              });

              expect(fetch.mock.calls[0][0]).toBe(
                '/query-params?string=string&number=0&boolean=false'
              );
            });

            test('array params (empty)', async () => {
              const fetch = vi.fn();
              const client = createClient<paths>({ fetch });
              mockResponseOnce(fetch, 200, { message: 'Success' });
              await client.GET('/query-params', {
                params: { query: { array: [] } }
              });

              expect(fetch.mock.calls[0][0]).toBe('/query-params');
            });

            test('empty/null params', async () => {
              const fetch = vi.fn();
              const client = createClient<paths>({ fetch });
              mockResponseOnce(fetch, 200, { message: 'Success' });
              await client.GET('/query-params', {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                params: { query: { string: undefined, number: null as any } }
              });

              expect(fetch.mock.calls[0][0]).toBe('/query-params');
            });
          });

          describe('array', () => {
            test.each([
              [
                'form',
                {
                  given: { style: 'form', explode: false },
                  want: 'array=1,2,3&boolean=true'
                }
              ],
              [
                'form (explode)',
                {
                  given: { style: 'form', explode: true },
                  want: 'array=1&array=2&array=3&boolean=true'
                }
              ],
              [
                'spaceDelimited',
                {
                  given: { style: 'spaceDelimited', explode: false },
                  want: 'array=1%202%203&boolean=true'
                }
              ],
              [
                'spaceDelimited (explode)',
                {
                  given: { style: 'spaceDelimited', explode: true },
                  want: 'array=1&array=2&array=3&boolean=true'
                }
              ],
              [
                'pipeDelimited',
                {
                  given: { style: 'pipeDelimited', explode: false },
                  want: 'array=1|2|3&boolean=true'
                }
              ],
              [
                'pipeDelimited (explode)',
                {
                  given: { style: 'pipeDelimited', explode: true },
                  want: 'array=1&array=2&array=3&boolean=true'
                }
              ]
            ] as [
              string,
              {
                given: NonNullable<QuerySerializerOptions['array']>;
                want: string;
              }
            ][])('%s', async (_, { given, want }) => {
              const fetch = vi.fn();
              const client = createClient<paths>({
                querySerializer: { array: given },
                fetch
              });
              mockResponse(fetch, 200, { message: 'Success' });
              await client.GET('/query-params', {
                params: {
                  query: { array: ['1', '2', '3'], boolean: true }
                }
              });

              expect(fetch.mock.calls[0][0].split('?')[1]).toBe(want);
            });
          });
        });

        describe('object', () => {
          test.each([
            [
              'form',
              {
                given: { style: 'form', explode: false },
                want: 'object=foo,bar,bar,baz&boolean=true'
              }
            ],
            [
              'form (explode)',
              {
                given: { style: 'form', explode: true },
                want: 'foo=bar&bar=baz&boolean=true'
              }
            ],
            [
              'deepObject',
              {
                given: { style: 'deepObject', explode: false }, // note: `false` not supported; same as `true`
                want: 'object[foo]=bar&object[bar]=baz&boolean=true'
              }
            ],
            [
              'deepObject (explode)',
              {
                given: { style: 'deepObject', explode: true },
                want: 'object[foo]=bar&object[bar]=baz&boolean=true'
              }
            ]
          ] as [
            string,
            {
              given: NonNullable<QuerySerializerOptions['object']>;
              want: string;
            }
          ][])('%s', async (_, { given, want }) => {
            const fetch = vi.fn();
            const client = createClient<paths>({
              querySerializer: { object: given },
              fetch
            });
            mockResponse(fetch, 200, { message: 'Success' });
            await client.GET('/query-params', {
              params: {
                query: { object: { foo: 'bar', bar: 'baz' }, boolean: true }
              }
            });

            expect(fetch.mock.calls[0][0].split('?')[1]).toBe(want);
          });
        });

        test('allowReserved', async () => {
          const fetch = vi.fn();
          const client = createClient<paths>({
            querySerializer: { allowReserved: true },
            fetch
          });
          mockResponse(fetch, 200, { message: 'Success' });
          await client.GET('/query-params', {
            params: {
              query: { string: 'bad/character🐶' }
            }
          });

          expect(fetch.mock.calls[0][0].split('?')[1]).toBe('string=bad/character🐶');

          await client.GET('/query-params', {
            params: {
              query: {
                string: 'bad/character🐶'
              }
            },
            querySerializer: {
              allowReserved: false
            }
          });
          expect(fetch.mock.calls[1][0].split('?')[1]).toBe('string=bad%2Fcharacter%F0%9F%90%B6');
        });

        describe('function', () => {
          test('global default', async () => {
            const fetch = vi.fn();
            const client = createClient<paths>({
              querySerializer: (q) => `alpha=${q.version}&beta=${q.format}`,
              fetch
            });
            mockResponse(fetch, 200, { message: 'Success' });

            await client.GET('/blogposts/{post_id}', {
              params: {
                path: { post_id: 'my-post' },
                query: { version: 2, format: 'json' }
              }
            });

            expect(fetch.mock.calls[0][0]).toBe('/blogposts/my-post?alpha=2&beta=json');
          });

          test('per-request', async () => {
            const fetch = vi.fn();
            const client = createClient<paths>({ fetch });
            mockResponse(fetch, 200, { message: 'Success' });

            await client.GET('/blogposts/{post_id}', {
              params: {
                path: { post_id: 'my-post' },
                query: { version: 2, format: 'json' }
              },
              querySerializer: (q) => `alpha=${q.version}&beta=${q.format}`
            });

            expect(fetch.mock.calls[0][0]).toBe('/blogposts/my-post?alpha=2&beta=json');
          });

          test('ignores leading ? characters', async () => {
            const fetch = vi.fn();
            const client = createClient<paths>({
              querySerializer: () => '?query',
              fetch
            });
            mockResponse(fetch, 200, { message: 'Success' });

            await client.GET('/blogposts/{post_id}', {
              params: {
                path: { post_id: 'my-post' },
                query: { version: 2, format: 'json' }
              }
            });

            expect(fetch.mock.calls[0][0]).toBe('/blogposts/my-post?query');
          });
        });
      });
    });

    describe('body', () => {
      // these are pure type tests; no runtime assertions needed
      /* eslint-disable vitest/expect-expect */
      test('requires necessary requestBodies', async () => {
        const fetch = vi.fn();
        const client = createClient<paths>({ baseUrl: 'https://myapi.com/v1', fetch });
        mockResponse(fetch, 200, { message: 'Success' });

        // @ts-expect-error expect error on missing 'body'
        await client.PUT('/blogposts');

        // @ts-expect-error expect error on missing fields
        await client.PUT('/blogposts', { body: { title: 'Foo' } });

        // (no error)
        await client.PUT('/blogposts', {
          body: {
            title: 'Foo',
            body: 'Bar',
            publish_date: new Date('2023-04-01T12:00:00Z').getTime()
          }
        });
      });

      test('requestBody (inline)', async () => {
        const fetch = vi.fn();
        const client = createClient<paths>({ fetch });
        mockResponse(fetch, 201, { message: 'Success' });

        await client.PUT('/blogposts-optional-inline', {
          // @ts-expect-error expect error on wrong body type
          body: { error: true }
        });

        // (no error)
        await client.PUT('/blogposts-optional-inline', {
          body: {
            title: '',
            publish_date: 3,
            body: ''
          }
        });
      });

      test('requestBody with required: false', async () => {
        const fetch = vi.fn();
        const client = createClient<paths>({ fetch });
        mockResponse(fetch, 201, {});

        // assert missing `body` doesn't raise a TS error
        await client.PUT('/blogposts-optional');

        // @ts-expect-error assert error on type mismatch
        await client.PUT('/blogposts-optional', { body: { error: true } });

        // (no error)
        await client.PUT('/blogposts-optional', {
          body: {
            title: '',
            publish_date: 3,
            body: ''
          }
        });
      });
    });
    /* eslint-enable vitest/expect-expect */
  });

  describe('options', () => {
    test('baseUrl', async () => {
      const fetch = vi.fn();
      let client = createClient<paths>({ baseUrl: 'https://myapi.com/v1', fetch });
      mockResponse(fetch, 200, { message: 'OK' });

      await client.GET('/self');
      expect(fetch.mock.calls[0][0]).toBe('https://myapi.com/v1/self');

      client = createClient<paths>({ baseUrl: 'https://myapi.com/v1/', fetch });

      await client.GET('/self');
      expect(fetch.mock.calls[1][0]).toBe('https://myapi.com/v1/self');
    });

    describe('headers', () => {
      test('persist', async () => {
        const headers: HeadersInit = { Authorization: 'Bearer secrettoken' };

        const fetch = vi.fn();
        const client = createClient<paths>({ headers, fetch });
        mockResponseOnce(fetch, 200, { email: 'user@user.com' });
        await client.GET('/self');

        expect(fetch.mock.calls[0][1].headers).toEqual({
          ...headers,
          'Content-Type': 'application/json'
        });
      });

      test('overwritten', async () => {
        const fetch = vi.fn();
        const client = createClient<paths>({
          headers: {
            'Cache-Control': 'max-age=10000000'
          },
          fetch
        });
        mockResponseOnce(fetch, 200, { email: 'user@user.com' });

        await client.GET('/self', {
          params: {},
          headers: { 'Cache-Control': 'no-cache' }
        });

        expect(fetch.mock.calls[0][1].headers).toEqual({
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        });
      });

      test('unset', async () => {
        const fetch = vi.fn();
        const client = createClient<paths>({
          headers: {
            'Content-Type': null
          },
          fetch
        });
        mockResponseOnce(fetch, 200, { email: 'user@user.com' });
        await client.GET('/self', { params: {} });

        expect(fetch.mock.calls[0][1].headers).toEqual({});
      });

      test('supports arrays', async () => {
        const fetch = vi.fn();
        const client = createClient<paths>({ fetch });
        const list = ['one', 'two', 'three'];
        mockResponseOnce(fetch, 200, {});

        await client.GET('/self', { headers: { list } });

        expect(fetch.mock.calls[0][1].headers['list']).toEqual(list.join(','));
      });
    });

    describe('fetch', () => {
      test('createClient', async () => {
        const createCustomFetch = (data: unknown) => async (url: string) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Promise.resolve({ data, url, headers: {}, ok: true, status: 200 } as Response<any>);

        const fetch = createCustomFetch({ works: true });
        const client = createClient<paths>({ fetch });

        const { data } = await client.GET('/self');

        expect(data).toEqual({ works: true });
      });

      test('per-request', async () => {
        const createCustomFetch = (data: unknown) => async (url: string) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Promise.resolve({ data, url, headers: {}, ok: true, status: 200 } as Response<any>);

        const fallbackFetch = createCustomFetch({ fetcher: 'fallback' });
        const overrideFetch = createCustomFetch({ fetcher: 'override' });

        const client = createClient<paths>({ fetch: fallbackFetch });

        const fetch1 = await client.GET('/self', { fetch: overrideFetch });
        expect(fetch1.data).toEqual({ fetcher: 'override' });

        const fetch2 = await client.GET('/self');
        expect(fetch2.data).toEqual({ fetcher: 'fallback' });
      });
    });

    describe('middleware', () => {
      test('can modify request', async () => {
        const fetch = vi.fn();
        mockResponseOnce(fetch, 200, {});

        const client = createClient<paths>({ fetch });
        client.use({
          async onRequest(req) {
            return {
              ...req,
              url: 'https://foo.bar/api/v1',
              headers: { foo: 'bar' },
              method: 'OPTIONS'
            };
          }
        });
        await client.GET('/self');

        const req = fetch.mock.calls[0][1];
        expect(req.url).toBe('https://foo.bar/api/v1');
        expect(req.headers).toEqual({ foo: 'bar' });
        expect(req.method).toBe('OPTIONS');
      });

      test('can modify response', async () => {
        const rawBody: {
          email: string;
          created_at: string | number;
          updated_at: string | number;
        } = {
          email: 'user123@gmail.com',
          created_at: '2023-04-01T12:00:00Z',
          updated_at: '2023-04-01T12:00:00Z'
        };
        const fetch = vi.fn();
        mockResponseOnce(fetch, 200, rawBody, {
          foo: 'bar'
        });

        const toUnix = (date: string | number) => new Date(date).getTime();

        const client = createClient<paths>({ fetch });
        client.use({
          async onResponse(res) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const body = res.data as typeof rawBody;

            body.created_at = toUnix(body.created_at);
            body.updated_at = toUnix(body.updated_at);

            const headers = res.headers;
            headers['middleware'] = 'value';

            return {
              ...res,
              body,
              status: 205,
              headers
            } as Response<typeof rawBody>;
          }
        });

        const { data, response } = await client.GET('/self');

        expect(data?.created_at).toBe(toUnix(rawBody.created_at));
        expect(data?.updated_at).toBe(toUnix(rawBody.updated_at));
        // assert rest of body was preserved
        expect(data?.email).toBe(rawBody.email);
        // assert status changed
        expect(response.status).toBe(205);
        // assert server headers were preserved
        expect(response.headers['foo']).toBe('bar');
        // assert middleware heaers were added
        expect(response.headers['middleware']).toBe('value');
      });

      test('executes in expected order', async () => {
        const fetch = vi.fn();
        mockResponseOnce(fetch, 200, {});

        const client = createClient<paths>({ fetch });
        client.use(
          {
            async onRequest(req) {
              if (req.headers) req.headers['step'] = 'A';
              return req;
            },
            async onResponse(res) {
              if (res.headers['step'] === 'B')
                return {
                  ...res,
                  headers: { ...res.headers, step: 'A' }
                };
            }
          },
          {
            async onRequest(req) {
              if (req.headers) req.headers['step'] = 'B';
              return req;
            },
            async onResponse(res) {
              if (res.headers['step'] === 'C')
                return {
                  ...res,
                  headers: { ...res.headers, step: 'B' }
                };
            }
          },
          {
            onRequest(req) {
              if (req.headers) req.headers['step'] = 'C';
              return req;
            },
            onResponse(res) {
              return {
                ...res,
                headers: { ...res.headers, step: 'C' }
              };
            }
          }
        );
        const { response } = await client.GET('/self');

        // assert requests ended up on step C (array order)
        expect(fetch.mock.calls[0][1].headers['step']).toBe('C');

        // assert responses ended up on step A (reverse order)
        expect(response.headers['step']).toBe('A');
      });

      test('receives correct options', async () => {
        const fetch = vi.fn();
        mockResponseOnce(fetch, 200, {});

        let baseUrl = '';

        const client = createClient<paths>({ baseUrl: 'https://myapi.com/v1', fetch });
        client.use({
          onRequest(_, options) {
            baseUrl = options.baseUrl;
            return undefined;
          }
        });

        await client.GET('/self');
        expect(baseUrl).toBe('https://myapi.com/v1');
      });

      test('receives OpenAPI options passed in from parent', async () => {
        const fetch = vi.fn();
        mockResponseOnce(fetch, 200, {});

        const pathname = '/tag/{name}';
        const tagData = {
          params: {
            path: {
              name: 'New Tag'
            }
          },
          body: {
            description: 'Tag Description'
          },
          query: {
            foo: 'bar'
          }
        };

        let receivedPath = '';
        let receivedParams: MiddlewareRequest['params'] = {};

        const client = createClient<paths>({ baseUrl: 'https://api.foo.bar/v1/', fetch });
        client.use({
          onRequest(req) {
            receivedPath = req.schemaPath;
            receivedParams = req.params;
            return undefined;
          }
        });

        await client.PUT(pathname, tagData);

        expect(receivedPath).toBe(pathname);
        expect(receivedParams).toEqual(tagData.params);
      });

      test('can be skipped without interrupting request', async () => {
        const fetch = vi.fn();
        mockResponseOnce(fetch, 200, { success: true });

        const client = createClient<paths>({ fetch });
        client.use({
          async onRequest() {
            return undefined;
          }
        });

        const { data } = await client.GET('/self');
        expect(data).toEqual({ success: true });
      });

      test('can be ejected', async () => {
        const fetch = vi.fn();
        mockResponseOnce(fetch, 200, { success: true });

        let called = false;
        const errorMiddleware = {
          onRequest() {
            called = true;
            throw new Error('oopsiee');
          }
        };

        const client = createClient<paths>({ baseUrl: 'https://api.foo.bar/v1', fetch });
        client.use(errorMiddleware);
        client.eject(errorMiddleware);

        expect(() => client.GET('/self')).not.toThrow();
        expect(called).toBe(false);
      });
    });
  });

  describe('responses', () => {
    test('returns empty object on 204', async () => {
      const fetch = vi.fn();
      mockResponseOnce(fetch, 204, undefined);

      const client = createClient<paths>({ fetch });
      const { data, error, response } = await client.DELETE('/tag/{name}', {
        params: { path: { name: 'New Tag' } }
      });

      // assert correct response
      expect(data).toEqual({});
      expect(response.status).toBe(204);

      // assert no error
      expect(error).toBeUndefined();
    });

    test('treats `default` as an error', async () => {
      const fetch = vi.fn();
      mockResponseOnce(fetch, 500, { code: 500, message: 'Internal Server Error' });

      const client = createClient<paths>({
        headers: { 'Cache-Control': 'max-age=10000000' },
        fetch
      });
      const { error } = await client.GET('/default-as-error');

      expect(error?.message).toBe('Internal Server Error');
    });

    // TODO: redo tests from down here
    describe('GET()', () => {
      test('sends the correct method', async () => {
        const fetch = vi.fn();
        const client = createClient<paths>({ fetch });
        mockResponseOnce(fetch, 200, {});

        await client.GET('/anyMethod');
        expect(fetch.mock.calls[0][1].method).toBe('GET');
      });

      test('sends correct options, success', async () => {
        const mockData = {
          title: 'My Post',
          body: '<p>This is a very good post</p>',
          publish_date: new Date('2023-03-01T12:00:00Z').getTime()
        };

        const fetch = vi.fn();
        const client = createClient<paths>({ fetch });
        mockResponseOnce(fetch, 200, mockData);

        const { data, error, response } = await client.GET('/blogposts/{post_id}', {
          params: { path: { post_id: 'my-post' } }
        });

        // assert correct URL
        expect(fetch.mock.calls[0][0]).toBe('/blogposts/my-post');

        // assert correct method was called
        expect(fetch.mock.calls[0][1].method).toBe('GET');

        expect(data).toEqual(mockData);
        expect(response.status).toBe(200);

        expect(error).toBeUndefined();
      });

      test('sends correct options, error', async () => {
        const mockError = {
          code: 404,
          message: 'Post not found'
        };

        const fetch = vi.fn();
        const client = createClient<paths>({ fetch });
        mockResponseOnce(fetch, 404, mockError);

        const { data, error, response } = await client.GET('/blogposts/{post_id}', {
          params: { path: { post_id: 'my-post' } }
        });

        // assert correct URL
        expect(fetch.mock.calls[0][0]).toBe('/blogposts/my-post');

        // assert correct method was called
        expect(fetch.mock.calls[0][1].method).toBe('GET');

        expect(error).toEqual(mockError);
        expect(response.status).toBe(404);

        expect(data).toBeUndefined();
      });

      test('handles array-type responses', async () => {
        const fetch = vi.fn();
        const client = createClient<paths>({ fetch });
        mockResponseOnce(fetch, 200, ['one']);

        const { data } = await client.GET('/blogposts', { params: {} });
        expect(data?.length).toBe(1);
      });

      test('handles literal 2xx and 4xx codes', async () => {
        const fetch = vi.fn();
        const client = createClient<paths>({ fetch });
        mockResponse(fetch, 201, { status: 'success' });

        const { data, error } = await client.PUT('/media', {
          body: { media: 'base64', name: 'myImage' }
        });

        if (data) {
          // assert 2XX type inferred correctly
          expect(data.status).toBe('success');
        } else {
          // assert 4XX type inferred correctly
          // (this should be a dead code path but tests TS types)
          expect(error.message).toBe('error');
        }
      });

      test('gracefully handles invalid JSON for errors', async () => {
        const fetch = vi.fn();
        const client = createClient<paths>({ fetch });
        mockResponseOnce(fetch, 401, 'Unauthorized');
        const { data, error } = await client.GET('/blogposts');

        expect(data).toBeUndefined();
        expect(error).toBe('Unauthorized');
      });
    });

    describe('POST()', () => {
      test('sends the correct method', async () => {
        const fetch = vi.fn();
        const client = createClient<paths>({ fetch });
        mockResponseOnce(fetch, 200, {});

        await client.POST('/anyMethod');
        expect(fetch.mock.calls[0][1].method).toBe('POST');
      });

      test('sends correct options, success', async () => {
        const fetch = vi.fn();
        const mockData = { status: 'success' };
        const client = createClient<paths>({ fetch });
        mockResponseOnce(fetch, 201, mockData);

        const { data, error, response } = await client.PUT('/blogposts', {
          body: {
            title: 'New Post',
            body: '<p>Best post yet</p>',
            publish_date: new Date('2023-03-31T12:00:00Z').getTime()
          }
        });

        expect(fetch.mock.calls[0][0]).toBe('/blogposts');
        expect(data).toEqual(mockData);
        expect(response.status).toBe(201);

        expect(error).toBeUndefined();
      });
    });

    describe('DELETE()', () => {
      test('sends the correct method', async () => {
        const fetch = vi.fn();
        const client = createClient<paths>({ fetch });
        mockResponseOnce(fetch, 204, '');

        const { data, error } = await client.DELETE('/blogposts/{post_id}', {
          params: { path: { post_id: '123' } }
        });

        expect(data).toEqual({});

        expect(error).toBeUndefined();
      });
    });
  });
});
