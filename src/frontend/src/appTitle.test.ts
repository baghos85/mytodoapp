import { describe, expect, it } from 'vitest';
import { appTitle } from './appTitle';

describe('appTitle', () => {
  it('appTitle_Always_IsMyTodoApp', () => {
    expect(appTitle).toBe('MyTodoApp');
  });
});
