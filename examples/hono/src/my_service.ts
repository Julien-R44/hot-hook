const currentDate = new Date()

export class MyService {
  doSomeBusinessLogic() {
    console.log('Hello from blabla')
    return currentDate.toString()
  }
}
