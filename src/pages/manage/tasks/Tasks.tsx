import { Button, Heading, HStack, VStack } from "@hope-ui/solid"
import { createSignal, For, onCleanup, Show } from "solid-js"
import { useFetch, useT } from "~/hooks"
import { PEmptyResp, PResp, TaskInfo } from "~/types"
import { handleResp, r } from "~/utils"
import { Task } from "./Task"
import { fsCopy } from "~/utils"

export interface TasksProps {
  type: string
  done: string
}
export const Tasks = (props: TasksProps) => {
  const t = useT()
  const [loading, get] = useFetch(
    (): PResp<TaskInfo[]> => r.get(`/admin/task/${props.type}/${props.done}`)
  )
  const [tasks, setTasks] = createSignal<TaskInfo[]>([])
  const refresh = async () => {
    const resp = await get()
    handleResp(resp, (data) =>
      setTasks(
        data?.sort((a, b) => {
          if (a.id > b.id) {
            return 1
          }
          return -1
        }) ?? []
      )
    )
  }
  refresh()
  if (props.done === "undone") {
    const interval = setInterval(refresh, 2000)
    onCleanup(() => clearInterval(interval))
  }
  const [clearLoading, clear] = useFetch(
    (): PEmptyResp => r.post(`/admin/task/${props.type}/clear_done`)
  )

  const [clearCompleteLoading, clearComplete] = useFetch(
    (): PEmptyResp =>
      new Promise<any>((resolve, reject) => {
        Promise.all(
          tasks()
            .filter(({ state }) => state == "succeeded")
            .map(({ id }) => {
              const [operateLoading, operate] = useFetch(
                (): PEmptyResp =>
                  r.post(`/admin/task/${props.type}/delete?tid=${id}`)
              )
              return operate()
            })
        )
          .then(() => {
            resolve({
              code: 200,
              message: "success",
              data: null,
            })
          })
          .catch(() => {
            reject({})
          })
      })
  )

  const [retryAllFailedLoading, retryAllFailed] = useFetch(
    (): PEmptyResp =>
      new Promise<any>((resolve, reject) => {
        Promise.all(
          tasks()
            .filter(({ state }) => state != "succeeded")
            .map(({ name }) => {
              const body = name.replace(
                /.*\[(.*)\]\((.*)\/(.*)\).*\[(.*)\]\((.*)\).*/,
                `{"src_dir":"$1$2","dst_dir":"$4$5","names":["$3"]}`
              )
              const data = JSON.parse(body)
              const [operateLoading, operate] = useFetch(fsCopy)
              return operate(data["src_dir"], data["dst_dir"], data["names"])
            })
        )
          .then(() => {
            resolve({
              code: 200,
              message: "success",
              data: null,
            })
          })
          .catch(() => {
            reject({})
          })
      })
  )
  return (
    <VStack w="$full" alignItems="start" spacing="$2">
      <Heading size="lg">{t(`tasks.${props.done}`)}</Heading>
      <Show when={props.done === "done"}>
        <HStack spacing="$2">
          <Button colorScheme="accent" loading={loading()} onClick={refresh}>
            {t(`global.refresh`)}
          </Button>
          <Button
            loading={clearLoading()}
            onClick={async () => {
              const resp = await clear()
              handleResp(resp, () => refresh())
            }}
          >
            {t(`global.clear`)}
          </Button>
          <Button
            loading={clearCompleteLoading()}
            onClick={async () => {
              const resp = await clearComplete()
              handleResp(resp, () => refresh())
            }}
          >
            {t(`global.clearComplete`, {}, "Clear Complete")}
          </Button>
          <Button
            loading={retryAllFailedLoading()}
            onClick={async () => {
              const resp = await retryAllFailed()
              handleResp(resp, () => refresh())
            }}
          >
            {t(`global.retryFailedTask`, {}, "Retry All Failed")}
          </Button>
        </HStack>
      </Show>
      <VStack w="$full" spacing="$2">
        <For each={tasks()}>{(task) => <Task {...task} {...props} />}</For>
      </VStack>
    </VStack>
  )
}

export const TypeTasks = (props: { type: string }) => {
  const t = useT()
  return (
    <VStack w="$full" alignItems="start" spacing="$4">
      <Heading size="xl">{t(`tasks.${props.type}`)}</Heading>
      <VStack w="$full" spacing="$2">
        <For each={["undone", "done"]}>
          {(done) => <Tasks type={props.type} done={done} />}
        </For>
      </VStack>
    </VStack>
  )
}
