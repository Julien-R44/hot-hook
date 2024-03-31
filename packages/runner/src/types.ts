/**
 * Options needed to run a script file
 */
export type RunOptions = {
  /**
   * Script to run
   */
  script: string

  /**
   * Arguments to pass to the script
   */
  scriptArgs: string[]

  /**
   * Arguments to pass to NodeJS CLI
   */
  nodeArgs: string[]

  /**
   * Standard input ouput stream options
   */
  stdio?: 'pipe' | 'inherit'

  /**
   * Environment variables to pass to the child process
   */
  env?: NodeJS.ProcessEnv
}

export interface DevServerOptions {
  /**
   * Clear the terminal screen before starting the server
   */
  clearScreen: boolean
}
